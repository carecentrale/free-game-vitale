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

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.css': 'text/css', '.svg': 'image/svg+xml' };
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
    // 0.6.93 (SPEC-028): "Not now" was tapped twice in this saved game, so at Fighting level 2 the fireball unlocks with the
    // "Magic unlocked!" panel as before. Mirelo's own tests start his lesson afresh (mirelo.load).
    mirelo: { lesson: 'todo', nots: 2 },
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
  // opts.noSupabase: the Supabase library cannot be loaded, as with no internet (0.6.90)
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/, route => opts.noSupabase ? route.abort() : route.fulfill({ status: 200, contentType: 'text/javascript', body: SUPABASE_STUB }));
  // The castle spacing set by the owner (0.6.76): read once when the game opens
  await page.route(/\/rest\/v1\/game_settings/, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ value: opts.castleGap || 500 }]) }));
  // opts.audioList: stands in for www/audio/credits.json, so the sound tests have files to ask for
  if (opts.audioList) await page.route(/\/audio\/credits\.json$/, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.audioList) }));
  const saves = opts.saves || [savedGame()];
  const choice = opts.choice === undefined ? '0' : opts.choice;
  // opts.quiz: quiz friends are on, as for a real player. In the other tests they are switched off, so that the friend
  // who now comes at the start (0.6.67) does not stand in the way of a tap or change the message on screen
  // opts.vital: Vital the guide comes, as for a new player (0.6.73). In the other tests his tips are switched off.
  // opts.togetherCard: the Playing together card shows (0.6.90), as on a new device. In the other tests it counts as seen.
  await page.addInitScript(({ saves, choice, quiz, vital, togetherCard }) => {
    if (!sessionStorage.getItem('seeded')) {
      if (!togetherCard) localStorage.setItem('kidsgame.togetherCard', '1');
      if (!quiz) localStorage.setItem('kidsgame.quiz', '0');
      if (!vital) localStorage.setItem('kidsgame.vital', JSON.stringify({ on: false }));
      saves.forEach((j, i) => localStorage.setItem('kidsgame.slot.' + i, j));
      if (choice !== null) sessionStorage.setItem('kidsgame.choice', choice);
      sessionStorage.setItem('seeded', '1');
    }
  }, { saves, choice, quiz: !!opts.quiz, vital: !!opts.vital, togetherCard: !!opts.togetherCard });
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

// After a right answer the question stays open with "Play again" and "Done" (0.6.78): tap Done, then wait for it to close
const quizClosed = async page => {
  await page.evaluate(() => { const d = document.querySelector('#quizPanel .qdone'); if (d) d.click(); });
  return page.waitForFunction(() => !window.gameTest.quizOpen, null, { timeout: 10000 });
};

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
    // Walk in a loop for 20 seconds of game time, turning now and then; check the enemies as we go.
    // Game time is played with stepFrames (0.25 s per check), in one call, not waited for: on slow test machines that
    // drew about one frame a second, real-time waiting gave too little game time and the test ran out of time (23 Nov 2026)
    const bad = await page.evaluate(() => {
      const g = window.gameTest, out = [];
      const moves = ['KeyW', 'KeyW', 'KeyD', 'KeyW', 'KeyA', 'KeyW', 'KeyS', 'KeyD'];
      for (let step = 0; step < 40; step++) {
        const key = moves[step % moves.length];
        dispatchEvent(new KeyboardEvent('keydown', { code: key }));
        for (let k = 0; k < 2; k++) {
          g.stepFrames(Array(5).fill(0.05));
          const st = window.gameProbe();
          for (const e of st.list) if (e.airT > 1.5) out.push({ step, player: [st.px, st.py, st.pz].map(v => Math.round(v)), ...e });
        }
        dispatchEvent(new KeyboardEvent('keyup', { code: key }));
      }
      return out;
    });
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

// 0.6.83: the castle loading screen goes away once the game is ready; the start menu has "Load my game" (the game played
// last), "Start a new game" and the tick box "Load my game by itself next time"
test('0.6.83 start menu: castle screen goes, Load my game opens the newest save, the tick box is kept', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 30000 });
    await page.waitForFunction(() => !!document.getElementById('slotLoad'), null, { timeout: 20000 });
    const r = await page.evaluate(() => ({
      play: document.getElementById('slotLoad').dataset.play,
      newGame: !!document.getElementById('slotNew'),
      ticked: document.getElementById('autoLoadBox').checked,
      cards: document.querySelectorAll('#slots .savecard').length,
    }));
    assert.equal(r.play, '1', 'Load my game should open the save played last (slot 1)');
    assert.ok(r.newGame, 'Start a new game should be on the menu');
    assert.equal(r.ticked, false, 'the tick box starts unticked');
    assert.equal(r.cards, 2, 'every saved game is still listed below');
    await page.evaluate(() => document.getElementById('autoLoadBox').click());   // a click in the page: the test browser draws too slowly for page.click
    assert.equal(await page.evaluate(() => localStorage.getItem('kidsgame.autoLoad')), '1');
    assert.deepEqual(errors, [], 'errors in the browser:\n' + errors.join('\n'));
  }, {
    saves: [JSON.stringify({ ...JSON.parse(savedGame()), at: 1000 }), JSON.stringify({ ...JSON.parse(savedGame()), name: 'Second Hero', at: 2000 })],
    choice: null,
  }));

test('0.6.83 with Load my game by itself on, the game played last opens with no start menu', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 30000 });
    const r = await page.evaluate(() => ({
      menu: !document.getElementById('slots').classList.contains('hide'),
      choice: sessionStorage.getItem('kidsgame.choice'),
    }));
    assert.equal(r.menu, false, 'the start menu should not show');
    assert.equal(r.choice, '1', 'the save played last (slot 1) should be open');
    assert.deepEqual(errors, [], 'errors in the browser:\n' + errors.join('\n'));
  }, {
    saves: [JSON.stringify({ ...JSON.parse(savedGame()), at: 1000 }), JSON.stringify({ ...JSON.parse(savedGame()), name: 'Second Hero', at: 2000 })],
    choice: null,
    init: () => localStorage.setItem('kidsgame.autoLoad', '1'),
  }));

// A saved game at Fighting level 2 (magic unlocks): the skill choice appears, and F fires a fireball
test('at Fighting level 2 the skill choice appears, and F shoots a fireball', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!document.querySelector('#skillPanel [data-skill="fireball"]'), null, { timeout: 60000 });
    // Clicked from inside the page: Playwright's own click waits for the page to draw steady frames, which timed out
    // on slow test machines (about one frame a second) although the button was there (23 Nov 2026)
    await page.evaluate(() => document.querySelector('#skillPanel [data-skill="fireball"]').click());
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
    // Game time is played with stepFrames (1/60 s each), not waited for: on slow test machines that drew about one
    // frame a second, 600 ms of real time was too little game time to swim up (23 Nov 2026)
    const { y0, y1, y2 } = await page.evaluate(() => {
      const g = window.gameTest, y = () => window.gameProbe().py;
      const y0 = y();
      g.stepFrames(Array(18).fill(1 / 60));   // 0.3 s
      const y1 = y();
      dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
      g.stepFrames(Array(36).fill(1 / 60));   // 0.6 s holding jump
      dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
      return { y0, y1, y2: y() };
    });
    assert.ok(y1 < y0 && y0 - y1 < 0.8, `sinking should be slow: ${y0} -> ${y1}`);
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
    // Clicked from inside the page (see the Fighting level 2 test)
    await page.evaluate(() => document.querySelector('#skillPanel [data-skill="fireball"]').click());
    await page.keyboard.press('Digit3');   // the fireball went into the first empty quick bar slot (slot 3)
    const before = await page.evaluate(() => { const p = window.gameProbe(); return p.fireballs + p.blasts; });
    await page.mouse.click(400, 300, { button: 'right' });
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => { const p = window.gameProbe(); return p.fireballs + p.blasts; });
    assert.ok(after > before, `right-click did not cast a fireball: ${before} -> ${after}`);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [fightLevel2Game()] }));

test('the Spell button is hidden until on-screen controls are on, then a tap on it and a tap on the world casts a fireball; there is no FIRE button', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!document.querySelector('#skillPanel [data-skill="fireball"]'), null, { timeout: 60000 });
    // Clicked from inside the page (see the Fighting level 2 test)
    await page.evaluate(() => document.querySelector('#skillPanel [data-skill="fireball"]').click());
    assert.equal(await page.evaluate(() => !!document.getElementById('bFire')), false, 'the FIRE button should be gone');
    const hidden = await page.evaluate(() => getComputedStyle(document.getElementById('bSpell')).display);
    assert.equal(hidden, 'none', 'the Spell button should be hidden while on-screen controls are off');
    await page.click('#toggle');
    // The game shows or hides the Spell button on its next frame, which can take a while on a slow machine: wait for it
    const shown = await page.waitForFunction(() => getComputedStyle(document.getElementById('bSpell')).display !== 'none', null, { timeout: 30000 }).then(() => true, () => false);
    assert.ok(shown, 'the Spell button should show once on-screen controls are on');
    const before = await page.evaluate(() => { const p = window.gameProbe(); return p.fireballs + p.blasts; });
    // 0.6.74: the tap on the button lights it up; the next tap on the world casts
    await page.evaluate(() => { document.getElementById('bSpell').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      const c = document.querySelector('body > canvas'); for (const t of ['pointerdown', 'pointerup']) c.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: innerWidth / 2, clientY: innerHeight * 0.4, pointerId: 3, button: 0 })); });
    const after = await page.waitForFunction(b => { const p = window.gameProbe(); return p.fireballs + p.blasts > b && p.fireballs + p.blasts; }, before, { timeout: 30000 })
      .then(h => h.jsonValue(), () => before);
    assert.ok(after > before, `the Spell button did not cast: ${before} -> ${after}`);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [fightLevel2Game()] }));

// A shot at a screen point is fired from the character toward that point, and it lasts long enough to reach a target
test('a fireball aimed at a screen point is fired and flies toward it', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!document.querySelector('#skillPanel [data-skill="fireball"]'), null, { timeout: 60000 });
    // Clicked from inside the page (see the Fighting level 2 test)
    await page.evaluate(() => document.querySelector('#skillPanel [data-skill="fireball"]').click());
    await page.waitForFunction(() => window.gameTest.skills.includes('fireball'), null, { timeout: 60000 });
    await page.evaluate(() => window.gameTest.stepFrames(Array(10).fill(0.05)));   // 0.5 s of game time: the spell cooldown wears off
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
    // Clicked from inside the page (see the Fighting level 2 test)
    await page.evaluate(() => document.querySelector('#skillPanel [data-skill="fireball"]').click());
    await page.waitForFunction(() => window.gameTest.skills.includes('fireball'), null, { timeout: 60000 });
    await page.evaluate(() => window.gameTest.stepFrames(Array(10).fill(0.05)));   // 0.5 s of game time: the spell cooldown wears off
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
    // Clicked from inside the page (see the Fighting level 2 test)
    await page.evaluate(() => document.querySelector('#skillPanel [data-skill="fireball"]').click());
    await page.waitForFunction(() => window.gameTest.skills.includes('fireball'), null, { timeout: 60000 });
    await page.evaluate(() => window.gameTest.stepFrames(Array(16).fill(0.05)));   // 0.8 s of game time: the spell cooldown wears off
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
test('a goblin has arms and legs that the game can swing, or (since 0.6.96) is its animated model', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => { const t = window.gameTest; return t.enemies.some(e => e.kind === 'goblin') || (t.spawnKind('goblin'), false); }, null, { timeout: 60000 });
    // Since 0.6.96 (SPEC-035) the goblin is an animated model, which moves its own arms and legs (checked by the SPEC-035
    // test). The limbs made in code are only there while the model has not loaded, or if it cannot load.
    const g = await page.evaluate(() => { const u = window.gameTest.enemies.find(e => e.kind === 'goblin').group.userData, l = u.limbs; return { limbs: l ? { arms: l.arms.length, legs: l.legs.length } : null, look: u.look || null }; });
    if (g.limbs) assert.deepEqual(g.limbs, { arms: 2, legs: 2 }); else assert.ok(g.look, 'the goblin is its animated model');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }));

// Performance is measured while the world is drawn: the numbers are printed so they can be recorded in docs/PERFORMANCE.md
test('performance is measured: frame rate, memory, draw calls, triangles', { skip, timeout: 400000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!document.querySelector('#skillPanel [data-skill="fireball"]'), null, { timeout: 60000 });
    // Clicked from inside the page (see the Fighting level 2 test)
    await page.evaluate(() => document.querySelector('#skillPanel [data-skill="fireball"]').click());
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
    // Clicked from inside the page (see the Fighting level 2 test)
    await page.evaluate(() => document.querySelector('#skillPanel [data-skill="fireball"]').click());
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
  test(`on a phone ${label}, the controls fit the screen and the quick bar starts hidden`, { skip, timeout: 120000 }, () =>
    withGame(async (page, errors) => {
      await page.waitForTimeout(1500);
      const st = await page.evaluate(() => ({
        phone: document.body.classList.contains('phone'),
        qb: getComputedStyle(document.getElementById('qb')).display,
        recent: getComputedStyle(document.getElementById('recent')).display,
        hudBtn: getComputedStyle(document.getElementById('hudBtn')).display,
        arrows: ['bF', 'bL', 'bR', 'bB'].filter(id => document.getElementById(id)).length,
      }));
      assert.ok(st.phone, 'the phone layout should be on');
      assert.equal(st.arrows, 0, 'the old arrow buttons should be gone');
      assert.equal(st.qb, 'none', 'the quick bar should start hidden on a phone');
      assert.equal(st.recent, 'none', 'the recent list should start hidden on a phone');
      assert.notEqual(st.hudBtn, 'none', 'the button to show them should be visible');
      assert.deepEqual(await offScreenControls(page), [], 'controls outside the screen');
      assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
    }, { device, saves: [phoneGame()] }));
}

test('on a phone, the top-left button shows the quick bar, and choosing a tool hides them again', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForTimeout(1500);
    // Taps are sent straight to the elements: the test browser can draw slowly, which makes simulated taps time out
    await page.evaluate(() => document.getElementById('hudBtn').click());
    const open = await page.evaluate(() => ({
      qb: getComputedStyle(document.getElementById('qb')).display,
      panel: window.gameTest.panelOpen,
    }));
    assert.ok(open.panel && open.qb !== 'none', 'tapping the button should show the quick bar: ' + JSON.stringify(open));
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

// Log off (0.6.84): from the quit question, saves and goes back to the start menu instead of the world.
// With "Load my game by itself" on (0.6.83), Log off must still show the menu, not reopen the same game.
const logOffCheck = async (page, errors, savedSlot) => {
  await page.waitForFunction(() => !!window.gameTest, null, { timeout: 60000 });
  const menuShown = () => page.evaluate(() => !document.getElementById('slots').classList.contains('hide'));
  assert.equal(await menuShown(), false, 'the game opens in the world, not on the menu');
  const before = await page.evaluate(n => JSON.parse(localStorage.getItem('kidsgame.slot.' + n)).at, savedSlot);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.gameTest.quitOpen), true, 'Esc asks first');
  await Promise.all([page.waitForEvent('load', { timeout: 30000 }), page.dispatchEvent('#quitLogOff', 'click')]);
  await page.waitForFunction(() => !!window.gameTest, null, { timeout: 60000 });
  assert.equal(new URL(page.url()).pathname, '/play/', 'Log off stays in the game page');
  const after = await page.evaluate(n => JSON.parse(localStorage.getItem('kidsgame.slot.' + n)).at, savedSlot);
  assert.ok(after > before, 'the game was saved before logging off');
  assert.equal(await menuShown(), true, 'the start menu is shown, so another game or world can be picked');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('kidsgame.choice')), 'menu', 'no saved game is picked for this tab');
  assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
};
test('0.6.84 Log off saves the game and opens the start menu', { skip, timeout: 150000 }, () =>
  withGame((page, errors) => logOffCheck(page, errors, 0), { saves: [readyGame()] }));
test('0.6.84 with Load my game by itself on, Log off still opens the start menu', { skip, timeout: 150000 }, () =>
  withGame((page, errors) => logOffCheck(page, errors, 0), {
    saves: [readyGame()], choice: null,
    init: () => localStorage.setItem('kidsgame.autoLoad', '1'),
  }));

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
// (a hand button is let go again straight away: held for half a second it would open the bag, 0.6.68)
const pressOn = (page, sel) => page.evaluate(s => {
  const el = document.querySelector(s);
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 7 }));
  if (s === '#bH1' || s === '#bH2') el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 7 }));
}, sel);
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

test('on a touch screen the fireball needs no quick bar slot: the Spell button and a tap on the world cast it, and it does nothing while a panel is open', { skip, timeout: 180000 }, () =>
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
      // 0.6.74: the button lights up, and the next tap on the world casts
      const c = document.querySelector('body > canvas');
      const world = () => { for (const t of ['pointerdown', 'pointerup']) c.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: innerWidth / 2, clientY: innerHeight * 0.4, pointerId: 8, button: 0, pointerType: 'touch' })); };
      tap(); world();
      const one = g.fireballs.length - n;
      tap(); world();   // straight away again: the power is still recharging
      return { one, two: g.fireballs.length - n, sel: g.sel };
    });
    assert.equal(cast.one, 1, 'a tap on the button and a tap on the world cast one fireball');
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
    // Clicked from inside the page (see the Fighting level 2 test)
    await page.evaluate(() => document.querySelector('#skillPanel [data-skill="fireball"]').click());
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
    const c = document.querySelector('body > canvas');
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
    const b = await tapMonster(page, { touch: true });   // (the goblin used to stand 3 blocks to the side: out of the sword's reach of 2 since 0.6.76, SPEC-016 B)
    assert.equal(b.error, undefined, b.error);
    assert.equal(b.after.hp, b.before.hp - 1, 'a touch hits once too');
    await page.evaluate(() => window.gameTest.stepFrames(Array(10).fill(0.05)));
    // A block in hand: the sword swings, and no block is placed
    await page.evaluate(() => { const g = window.gameTest; g.selectSlot(2); g.toQuick('dirt'); });
    const c = await tapMonster(page, {});
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
      if (document.elementFromPoint(x, y) !== document.querySelector('body > canvas')) continue;   // a button is on top here
      const c = g.aimAt(x, y);
      if (!c || c.enemy || c.dist > g.reach || !g.isSolid(g.blockAt(...c.dig)) || g.isSolid(g.blockAt(...c.place))) continue;
      if (Math.abs(c.place[0] + 0.5 - px) < 1.2 && Math.abs(c.place[2] + 0.5 - pz) < 1.2 && c.place[1] + 1 > py && c.place[1] < py + 2.2) continue;   // too close to the character
      pt = [x, y]; a = c;
    }
    if (!pt) return { error: 'no close block was found under the screen' };
    const c = document.querySelector('body > canvas');
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

test('with the sword in hand, a tap on a close monster hits it once straight away, a second tap at once does not, and holding keeps hitting', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    await page.keyboard.press('Digit2');
    // One tap: one hit and one wear, at the press (0.6.66; before, only holding hit). A second tap straight away does nothing more
    const a = await tapMonster(page, { again: true });
    assert.equal(a.error, undefined, a.error);
    assert.ok(a.held.hp < a.before.hp || !a.held.alive, 'the tap did not hit');
    assert.equal(a.held.dur.sword, a.before.dur.sword - 1, 'one tap wears the sword by one');
    assert.equal(a.after.hp, a.held.hp, 'a second tap straight away hit again');
    assert.equal(a.after.dur.sword, a.held.dur.sword);
    assert.equal(a.after.fight, false, 'letting go stops the fight');
    assert.equal(a.after.sel, 1, 'the sword stays in hand');
    assert.ok(a.log.includes('swing'), 'no swing sound');
    await page.evaluate(() => window.gameTest.stepFrames(Array(10).fill(0.05)));   // the swing is over
    // Too far away: no hit
    const far = await page.evaluate(() => {
      const g = window.gameTest;
      g.clearEnemies(); g.setYaw(0); g.settleCamera();
      if (!g.enemyNear('goblin', 0, -11)) return { error: 'no far goblin' };
      const en = g.enemies[0], [sx, sy] = g.screenOf(en), c = document.querySelector('body > canvas'), hp = en.hp;
      const ev = t => c.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: sx, clientY: sy, pointerId: 5, button: 0 }));
      ev('pointerdown'); ev('pointerup');
      return { hit: en.hp < hp };
    });
    assert.equal(far.error, undefined, far.error);
    assert.equal(far.hit, false, 'a monster out of reach was hit');
    await page.evaluate(() => window.gameTest.stepFrames(Array(10).fill(0.05)));
    const b = await tapMonster(page, { hold: 60 });
    assert.ok(b.held.hp < b.before.hp || !b.held.alive, 'the press hits');
    assert.ok(b.heldLong.dur.sword < b.held.dur.sword, 'holding keeps hitting');
    assert.equal(b.error, undefined, b.error);
    assert.ok(b.heldLong.hp < b.before.hp || !b.heldLong.alive, 'holding hits the monster');
    assert.ok(b.heldLong.dur.sword < b.before.dur.sword, 'holding wears the sword');
    assert.equal(b.after.sel, 1, 'the sword stays in hand');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()] }));

test('with the fireball in hand, a tap on a close monster casts a fireball and does not swing the sword', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!document.querySelector('#skillPanel [data-skill="fireball"]'), null, { timeout: 60000 });
    // Clicked from inside the page (see the Fighting level 2 test)
    await page.evaluate(() => document.querySelector('#skillPanel [data-skill="fireball"]').click());
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

// ---- A tap outside a window closes it (0.6.71) ----
test('a tap on the world outside the bag, Settings or the quit question closes it and does nothing else; a tap inside keeps it open', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    const r = await page.evaluate(() => {
      const g = window.gameTest, c = document.querySelector('body > canvas'), out = {};
      const tap = (el, x, y) => { for (const t of ['pointerdown', 'pointerup']) el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 11, button: 0 })); };
      const opens = { bag: () => document.getElementById('bagBtn').click(), settings: () => document.getElementById('settingsBtn').click(), quit: () => g.backAction() };
      const isOpen = { bag: () => g.bagOpen, settings: () => g.settingsOpen, quit: () => g.quitOpen };
      const box = { bag: 'bag', settings: 'settings', quit: 'quit' };
      for (const k of Object.keys(opens)) {
        opens[k]();
        const opened = isOpen[k]();
        const el = document.getElementById(box[k]), b = el.getBoundingClientRect();
        tap(el, b.left + b.width / 2, b.top + 6);
        const afterInside = isOpen[k]();
        tap(c, 3, innerHeight - 3);
        out[k] = { opened, afterInside, afterOutside: isOpen[k](), digging: !!g.digging, fight: !!g.fight };
      }
      return out;
    });
    for (const [k, v] of Object.entries(r)) {
      assert.equal(v.opened, true, k + ' did not open');
      assert.equal(v.afterInside, true, 'a tap inside closed ' + k);
      assert.equal(v.afterOutside, false, 'a tap outside did not close ' + k);
      assert.equal(v.digging || v.fight, false, 'the tap that closed ' + k + ' also dug or fought');
    }
    assert.deepEqual(errors, []);
  }, { saves: [readyGame()] }));

// ---- Quiz Friends (0.6.63, SPEC-003) ----
// Time is played with stepFrames (no waiting): 20 frames of 0.05 s are one second of play.
// Brings a friend next to the character: no monsters, a new friend, and enough play time for it to walk up
// (ask: the kind of question it will ask, for example 'add' or 'word'; left out, the game chooses when the friend is tapped)
const friendArrives = (page, kind, ask) => page.evaluate(([k, ask]) => {
  const g = window.gameTest;
  g.clearEnemies();
  g.removeFriend();
  if (!g.callFriend(k)) return { error: 'no friend could be placed' };
  const start = g.friend, [px, , pz] = g.pos;
  for (let s = 0; s < 8; s++) { g.clearEnemies(); g.stepFrames(Array(20).fill(0.05)); }
  if (ask) g.askKind(ask);
  return { start: Math.hypot(start.x - px, start.z - pz), end: Math.hypot(g.friend.x - g.pos[0], g.friend.z - g.pos[2]), friend: g.friend, open: g.quizOpen };
}, [kind, ask]);
// A press and release on the friend, as a finger or the mouse; o.drag moves sideways in between
const pressFriend = (page, o = {}) => page.evaluate(o => {
  const g = window.gameTest;
  g.settleCamera();
  const [x, y, front] = g.friendScreen();
  if (!front) return { error: 'the friend is behind the camera' };
  const c = document.querySelector('body > canvas');
  const ev = (t, dx = 0) => c.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: x + dx, clientY: y, pointerId: 9, button: 0, pointerType: o.touch ? 'touch' : 'mouse' }));
  ev('pointerdown');
  const held = { digging: !!g.digging, fight: !!g.fight };
  if (o.drag) ev('pointermove', o.drag);
  ev('pointerup');
  return { held, open: g.quizOpen, fireballs: g.fireballs.length, msg: g.msg };
}, o);
// A tap on the "?" bubble over the friend's head (0.6.71); o.miss taps well above the bubble instead
const tapBubble = (page, o = {}) => page.evaluate(o => {
  const g = window.gameTest;
  g.settleCamera();
  const b = g.friendBubbleScreen();
  if (!b) return { error: 'the bubble is hidden or behind the camera' };
  const [fx, fy] = g.friendScreen();
  const x = b[0], y = o.miss ? b[1] - b[2] * 3 : b[1];
  const c = document.querySelector('body > canvas');
  const ev = t => c.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 9, button: 0, pointerType: o.touch ? 'touch' : 'mouse' }));
  ev('pointerdown'); ev('pointerup');
  return { open: g.quizOpen, awayFromBody: Math.hypot(b[0] - fx, b[1] - fy), bubbleSize: b[2] };
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

test('a quiz friend comes as soon as play starts, even with monsters about, with a "?" over its head; it waves and stops two blocks away', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    const r = await page.evaluate(() => {
      const g = window.gameTest, first = g.friendWait, monsters = g.enemies.length;
      let secs = 0;
      while (!g.friend && secs < 30) { g.stepFrames(Array(20).fill(0.05)); secs++; }
      const f = g.friend, [px, , pz] = g.pos;
      return { first, secs, monsters, f, dist: f ? Math.hypot(f.x - px, f.z - pz) : null, msg: g.msg, second: g.callFriend(), open: g.quizOpen };
    });
    assert.ok(r.first <= 3, 'the first friend is due within 3 seconds of play: ' + r.first);
    assert.ok(r.monsters >= 1, 'there are monsters about at the start');
    assert.ok(r.f, 'no friend came at the start');
    assert.ok(r.secs <= 4, 'it came after ' + r.secs + ' seconds');
    assert.ok(['owl', 'turtle', 'robot'].includes(r.f.kind));
    assert.ok(r.f.inScene && r.f.bubble, 'the friend and its "?" bubble are shown');
    // (it appears 7 to 11 blocks away; by the time it is looked at here it may have walked for up to a second)
    assert.ok(r.dist >= 4 && r.dist <= 11.5, 'it appears near the child: ' + r.dist);
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
  }, { saves: [readyGame()], quiz: true }));

test('a tap on the "?" bubble over a quiz friend opens the question, with a finger or the mouse; a tap above the bubble does not', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    for (const [kind, touch] of [['owl', false], ['robot', true]]) {
      const a = await friendArrives(page, kind, 'add');
      assert.equal(a.error, undefined, a.error);
      const miss = await tapBubble(page, { touch, miss: true });
      assert.equal(miss.error, undefined, miss.error);
      assert.equal(miss.open, false, 'a tap above the bubble opened the question');
      const hit = await tapBubble(page, { touch });
      assert.equal(hit.open, true, 'a tap on the bubble did not open the question (' + kind + ')');
      await page.evaluate(() => window.gameTest.quizNotNow());
    }
    assert.deepEqual(errors, []);
  }, { saves: [spellGame()], quiz: true }));

test('the friend never opens the question itself; a tap on it opens one question with three answers and "Not now", which changes nothing', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    for (const [kind, touch, ask] of [['owl', false, 'add'], ['turtle', true, 'more'], ['robot', false, 'next']]) {
      const a = await friendArrives(page, kind, ask);
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
  }, { saves: [spellGame()], quiz: true }));

test('a right first answer gives 5 gems, a right answer after a wrong try gives 2, a wrong answer takes nothing, and a picture hint shows after two wrong tries', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    let turn = 0;
    const open = async () => {
      const a = await friendArrives(page, undefined, ['count', 'add', 'take', 'more', 'next'][turn++ % 5]);
      assert.equal(a.error, undefined, a.error);
      const t = await pressFriend(page);
      assert.equal(t.open, true);
      return page.evaluate(() => window.gameTest.quizQuestion.right);
    };
    const closed = () => quizClosed(page);
    // Right first time: stars, 5 gems, then the friend leaves
    let start = await gems(page), right = await open();
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
      const wait = g.friendWait;
      // Standing still, the minute does not run down; moving about, it does, and the next friend comes
      for (let i = 0; i < 90; i++) { g.clearEnemies(); g.stepFrames(Array(20).fill(0.05)); }
      const still = { wait: g.friendWait, friend: !!g.friend };
      g.setStick(0, -1);
      let secs = 0;
      while (!g.friend && secs < 70) { g.clearEnemies(); g.stepFrames(Array(20).fill(0.05)); secs++; }
      g.setStick(0, 0);
      return { state, gone: wait !== undefined && still.friend === false, wait, onMove: g.friendOnMove, still, secs, next: !!g.friend };
    });
    assert.equal(left.state, 'leave');
    assert.equal(left.gone, true, 'the friend did not leave');
    assert.equal(left.wait, 60, 'after a right answer the next friend is due after a minute of moving about');
    assert.deepEqual(left.still, { wait: 60, friend: false }, 'the minute ran down while the child stood still');
    assert.equal(left.next, true, 'no friend came after a minute of moving about');
    assert.ok(left.secs >= 58 && left.secs <= 62, 'it came after ' + left.secs + ' seconds of moving');
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
    // No question and no answer is kept on the device (the saved game holds the counts of the quiz report only, 0.6.65)
    const kept = await page.evaluate(() => { window.gameTest.stepFrames([0.05]); return Object.keys(localStorage).map(k => k + '=' + localStorage.getItem(k)).join('\n'); });
    assert.ok(!/friend|How many|What is|comes next|the most|"answers"|"right"/i.test(kept), 'a question or an answer is stored on the device');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()], quiz: true }));

test('in 20 questions in a row from friends, each maths question has three answers with one right, and none repeats within 10', { skip, timeout: 240000 }, () =>
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
        return { key: q.key, right: q.right, n, word: q.word, letters: q.letters, labels: (q.answers || []).map(a => (a.label || '') + '/' + (a.n ? '' : a.shape || '')) };
      });
      if (q.word) {   // a word scramble: its own letters, mixed up
        assert.equal(q.n, 0);
        assert.deepEqual([...q.letters].sort(), q.word.split('').sort());
        assert.notEqual(q.letters.join(''), q.word);
      } else {
        assert.equal(q.n, 3);
        assert.equal(new Set(q.labels).size, 3, 'answers are not all different: ' + q.labels);
        assert.ok(q.right >= 0 && q.right < 3);
      }
      assert.ok(!keys.slice(-10).includes(q.key), 'question ' + (i + 1) + ' repeats within 10: ' + q.key);
      keys.push(q.key);
    }
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()], quiz: true }));

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
  }, { saves: [readyGame()], quiz: true }));

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
      return { left, gone: g.friend === null, msgs: [...msgs].join(' | '), open: g.quizOpen, wait: g.friendWait, onMove: g.friendOnMove };
    });
    assert.ok(stay.wait >= 235 && stay.wait <= 420 && stay.onMove === false, 'after a friend leaves with no right answer, the next comes 4 to 7 minutes of play later: ' + stay.wait);
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
  }, { saves: [readyGame()], quiz: true }));

const PC = { viewport: { width: 1280, height: 720 } };
for (const [label, device] of [['a phone held sideways', PHONE_WIDE], ['a phone held upright', PHONE_TALL], ['a tablet', TABLET], ['a PC', PC]]) {
  test(`on ${label}, the question panel fits the screen and its buttons are big enough to tap`, { skip, timeout: 240000 }, () =>
    withGame(async (page, errors) => {
      await playing(page);
      for (const kind of ['count', 'add', 'take', 'more', 'next', 'word']) {
        for (let n = 0; n < 4; n++) {
          const r = await page.evaluate(kind => {
            const g = window.gameTest;
            g.clearEnemies(); g.removeFriend(); g.callFriend();
            g.askKind(kind);
            g.openQuiz();
            const measure = () => {
              const inView = el => { const b = el.getBoundingClientRect(); return b.left >= -0.5 && b.top >= -0.5 && b.right <= innerWidth + 0.5 && b.bottom <= innerHeight + 0.5; };
              const p = document.getElementById('quizPanel'), box = p.querySelector('.qbox');
              const btns = [...p.querySelectorAll('.qa,.qt,.qs')], not = p.querySelector('.qnot'), least = p.querySelector('.qa') ? 60 : 48;
              return { box: inView(box), text: parseFloat(getComputedStyle(p.querySelector('.qtext')).fontSize), textIn: inView(p.querySelector('.qtext')),
                btnIn: btns.every(inView) && inView(not), small: btns.filter(b => b.getBoundingClientRect().height < least || b.getBoundingClientRect().width < least).length,
                notH: not.getBoundingClientRect().height, scroll: box.scrollHeight - box.clientHeight, wide: box.scrollWidth - box.clientWidth };
            };
            const first = measure();
            const q = g.quizQuestion;
            if (kind === 'word') for (let t = 0; t < 2; t++) q.letters.forEach((_, i) => g.quizTile(i));   // two wrong words (the tiles in the order shown are never the word)
            else for (const i of [0, 1, 2].filter(i => i !== q.right)) g.answerQuiz(i);   // two wrong tries: the hint shows
            const hinted = measure();
            const hint = kind === 'word' ? g.quizSpell.fixed === 1 && !!document.querySelector('#quizPanel .qs.fix') : getComputedStyle(document.querySelector('#quizPanel .qhint')).display !== 'none';
            g.quizNotNow();
            return { first, hinted, hint, key: q.key };
          }, kind);
          const where = label + ', ' + r.key;
          assert.equal(r.first.box, true, 'the panel is off the screen: ' + where);
          assert.equal(r.first.textIn && r.first.btnIn, true, 'the question or a button is off the screen: ' + where);
          assert.equal(r.first.scroll <= 1 && r.first.wide <= 1, true, 'the panel needs scrolling: ' + where);
          assert.ok(r.first.text >= 22, 'the question text is small: ' + r.first.text);
          assert.equal(r.first.small, 0, 'an answer button is smaller than 60 points, or a letter smaller than 48: ' + where);
          assert.ok(r.first.notH >= 48, '"Not now" is smaller than 48 points');
          assert.equal(r.hint, true);
          assert.equal(r.hinted.box, true, 'with the hint, the panel is off the screen: ' + where);
          assert.equal(r.hinted.btnIn && r.hinted.scroll <= 1, true, 'with the hint, a button is off the screen: ' + where);
          assert.equal(r.hinted.small, 0);
        }
      }
      assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
    }, { device, saves: [readyGame()], quiz: true }));
}

// ---- Life bars for monsters (0.6.64) ----
test('a monster shows a life bar over its head only once it has been hit; the bar shrinks and turns yellow, then red, and goes when the monster is defeated', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    const r = await page.evaluate(() => {
      const g = window.gameTest;
      g.stepFrames([0.05]);
      const all = g.lifeBars(), count = g.lifeBarCount(), monsters = g.enemies.length;
      g.clearEnemies();
      g.enemyNear('brute', 2, -2);
      const en = g.enemies[0], full = g.ENEMY_KINDS.brute.health;
      const look = () => { g.stepFrames([0.05]); return g.lifeBars()[0]; };
      const fresh = look();
      const steps = [];
      for (let hp = full - 1; hp >= 1; hp--) { g.hurtEnemy(en, 1); steps.push(look()); }
      const before = g.lifeBarCount();
      g.hurtEnemy(en, 1);   // the last hit defeats it
      g.stepFrames([0.05]);
      return { all, count, monsters, full, fresh, steps, before, after: g.lifeBarCount(), left: g.enemies.length,
        colors: [1, 0.61, 0.6, 0.31, 0.3, 0.05].map(g.lifeColor) };
    });
    assert.ok(r.monsters >= 1, 'no monsters to check');
    assert.equal(r.all.length, r.monsters);
    for (const b of r.all) {
      assert.ok(b && b.inScene, 'a monster has no life bar');
      assert.equal(b.part, 1, 'a fresh monster does not have a full bar');
      assert.equal(b.shown, false, 'a monster that has not been hit shows its life bar');
      assert.ok(b.above > 0.9 && b.above < 2.6, 'the bar is not just over the head of the ' + b.kind + ': ' + b.above);
      assert.ok(Math.abs(b.dx) < 1e-6 && Math.abs(b.dz) < 1e-6, 'the bar is not over its monster');
    }
    assert.deepEqual(r.count, { bars: r.monsters, inScene: r.monsters }, 'one bar for each monster');
    assert.equal(r.fresh.part, 1);
    assert.equal(r.fresh.shown, false, 'the bar shows before the first hit');
    assert.equal(r.fresh.color, r.colors[0]);
    r.steps.forEach((b, i) => {
      const hp = r.full - 1 - i;
      assert.equal(b.hp, hp);
      assert.equal(b.shown, true, 'the bar is hidden after a hit');
      assert.ok(Math.abs(b.part - hp / r.full) < 1e-9, 'the bar does not show ' + hp + ' of ' + r.full);
    });
    assert.equal(new Set(r.colors).size, 3, 'three colours');
    assert.deepEqual(r.colors, [r.colors[0], r.colors[0], r.colors[2], r.colors[2], r.colors[4], r.colors[4]], 'green above 60%, yellow down to 30%, red below');
    assert.equal(r.steps[r.steps.length - 1].color, r.colors[4], 'a nearly defeated monster has a red bar');
    assert.deepEqual(r.before, { bars: 1, inScene: 1 });
    assert.equal(r.left, 0, 'the monster was not defeated');
    assert.deepEqual(r.after, { bars: 0, inScene: 0 }, 'the bar stayed after the monster was defeated');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()] }));

// ---- Word scramble and the quiz report (0.6.65) ----
// Taps the letter tiles that spell `word` (o.wrong: in an order that does not), skipping letters already in place
const spell = (page, o = {}) => page.evaluate(o => {
  const g = window.gameTest, q = g.quizQuestion, placed = g.quizSpell.picked.slice();
  let order = [];
  const free = q.letters.map((_, i) => i).filter(i => !placed.includes(i));
  if (o.wrong) {
    order = free.slice();
    const made = () => [...placed, ...order].map(i => q.letters[i]).join('');
    for (let n = 0; n < 6 && made() === q.word; n++) order.push(order.shift());
    if (made() === q.word) order.reverse();
  } else {
    for (let j = placed.length; j < q.word.length; j++) { const i = free.find(i => q.letters[i] === q.word[j] && !order.includes(i)); order.push(i); }
  }
  for (const i of order) document.querySelector(`#quizPanel .qt[data-t="${i}"]`).click();
  const p = document.getElementById('quizPanel');
  return { gems: g.inv.gem, msg: p ? p.querySelector('.qmsg').textContent : null, spell: g.quizSpell, stars: p ? p.querySelectorAll('.qstars svg').length : 0,
    slots: p ? [...p.querySelectorAll('.qs')].map(b => b.textContent).join('|') : null, used: p ? p.querySelectorAll('.qt.used').length : 0, wob: p ? p.querySelectorAll('.qslots.wob').length : 0 };
}, o);

test('a word scramble shows a picture and mixed-up letter tiles; tapping them in order spells the word for 5 gems, a wrong word takes nothing, and the first letter is given after two wrong tries', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    const closed = () => quizClosed(page);
    const open = async () => {
      const a = await friendArrives(page, undefined, 'word');
      assert.equal(a.error, undefined, a.error);
      const t = await pressFriend(page);
      assert.equal(t.open, true);
      return page.evaluate(() => {
        const p = document.getElementById('quizPanel'), q = window.gameTest.quizQuestion;
        return { word: q.word, letters: q.letters, text: p.querySelector('.qtext').textContent, clue: p.querySelector('.qclue img') ? p.querySelector('.qclue img').getAttribute('src') : '', slots: p.querySelectorAll('.qs').length,
          tiles: [...p.querySelectorAll('.qt')].map(b => b.textContent).join(''), answers: p.querySelectorAll('.qa').length, notNow: !!p.querySelector('.qnot'),
          typing: p.querySelectorAll('input,textarea,select,[contenteditable]').length };
      });
    };
    // The panel: a picture, one place and one tile for each letter, no three-answer buttons, nowhere to type
    let start = await gems(page), q = await open();
    assert.equal(q.text, 'Spell the word');
    assert.ok(q.clue.length > 0, 'no picture clue');
    assert.equal(q.slots, q.word.length);
    assert.equal(q.tiles, q.letters.join(''));
    assert.notEqual(q.tiles, q.word, 'the tiles are already in order');
    assert.equal(q.answers, 0);
    assert.equal(q.notNow, true);
    assert.equal(q.typing, 0, 'there is a place to type');
    // One tile goes to the first place and is dimmed; a tap on that place takes it back
    const one = await page.evaluate(() => {
      const g = window.gameTest;
      document.querySelector('#quizPanel .qt[data-t="1"]').click();
      const placed = { spell: g.quizSpell.letters, slot: document.querySelector('#quizPanel .qs[data-s="0"]').textContent, used: document.querySelectorAll('#quizPanel .qt.used').length };
      document.querySelector('#quizPanel .qt[data-t="1"]').click();   // a used tile does nothing
      const again = g.quizSpell.letters;
      document.querySelector('#quizPanel .qs[data-s="0"]').click();
      return { placed, again, back: g.quizSpell.letters, used: document.querySelectorAll('#quizPanel .qt.used').length };
    });
    assert.deepEqual(one.placed, { spell: q.letters[1], slot: q.letters[1], used: 1 });
    assert.equal(one.again, q.letters[1]);
    assert.deepEqual([one.back, one.used], ['', 0]);
    // The right word, first time: stars and 5 gems
    let r = await spell(page);
    assert.equal(r.gems, start + 5);
    assert.match(r.msg, /\+5 gems/);
    assert.ok(r.stars > 5, 'no stars');
    assert.equal(r.slots.replaceAll('|', ''), q.word);
    await closed();
    assert.equal(await page.evaluate(() => window.gameTest.friend.state), 'leave');
    // Wrong words: nothing lost, "Try again", the letters go back; after two, the first letter is put in place and stays
    start = await gems(page); q = await open();
    r = await spell(page, { wrong: true });
    assert.equal(r.gems, start, 'a wrong word changed the gems');
    assert.equal(r.msg, 'Try again');
    assert.deepEqual([r.spell.letters, r.spell.fixed, r.spell.wrong, r.used, r.wob], ['', 0, 1, 0, 1]);
    r = await spell(page, { wrong: true });
    assert.equal(r.gems, start);
    assert.deepEqual([r.spell.letters, r.spell.fixed, r.spell.wrong, r.used], [q.word[0], 1, 2, 1], 'the first letter was not given after two wrong tries');
    const fixed = await page.evaluate(() => { document.querySelector('#quizPanel .qs[data-s="0"]').click(); return window.gameTest.quizSpell.letters; });
    assert.equal(fixed, q.word[0], 'the given letter could be taken away');
    // "Not now" and back: the same word, with its first letter still in place. Then the right word gives 2 gems
    await page.evaluate(() => document.querySelector('#quizPanel .qnot').click());
    assert.equal(await gems(page), start);
    assert.equal((await pressFriend(page)).open, true);
    assert.deepEqual(await page.evaluate(() => [window.gameTest.quizQuestion.word, window.gameTest.quizSpell.letters]), [q.word, q.word[0]]);
    r = await spell(page);
    assert.equal(r.gems, start + 2);
    assert.match(r.msg, /\+2 gems/);
    await closed();
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()], quiz: true }));

test('the quiz report counts questions seen and right answers for maths and words, is kept with the saved game, and shows in the parent area', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors, requests) => {
    await playing(page);
    const closed = () => quizClosed(page);
    const stats = () => page.evaluate(() => window.gameTest.quizStats);
    const blank = { opened: 0, first: 0, later: 0, hints: 0, swaps: 0 };   // hints and swaps are counted too since 0.6.78
    assert.deepEqual(await stats(), { math: blank, words: blank, since: null, last: null });
    // Friends ask until one maths question and one word have come up (the game chooses); each is counted as seen once
    const seen = { math: 0, words: 0 };
    let mathRight = null, guard = 0;
    while ((!seen.math || !seen.words) && guard++ < 40) {
      const a = await friendArrives(page);
      assert.equal(a.error, undefined, a.error);
      assert.equal((await pressFriend(page)).open, true);
      const q = await page.evaluate(() => { const q = window.gameTest.quizQuestion; return { word: q.word || null, right: q.right }; });
      const sub = q.word ? 'words' : 'math';
      seen[sub]++;
      await page.evaluate(() => document.querySelector('#quizPanel .qnot').click());
      // Opening the same question again is not counted twice
      assert.equal((await pressFriend(page)).open, true);
      if (sub === 'math' && mathRight === null) {   // answer this one: wrong once, then right
        mathRight = q.right;
        await clickAnswer(page, (q.right + 1) % 3);
        await page.evaluate(i => document.querySelector(`#quizPanel .qa[data-a="${i}"]`).click(), q.right);
        await closed();
      } else if (sub === 'words' && seen.words === 1) {   // spell this one right first time
        await spell(page);
        await closed();
      } else await page.evaluate(() => document.querySelector('#quizPanel .qnot').click());
    }
    const st = await stats();
    const three = ({ opened, first, later }) => ({ opened, first, later });
    assert.deepEqual(three(st.math), { opened: seen.math, first: 0, later: 1 });
    assert.deepEqual(three(st.words), { opened: seen.words, first: 1, later: 0 });
    for (const sub of ['math', 'words']) for (const k of ['hints', 'swaps']) assert.ok(Number.isInteger(st[sub][k]) && st[sub][k] >= 0, sub + ' ' + k);
    assert.match(st.since, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(st.last, st.since);
    // Kept with the saved game: only the counts and two dates
    const kept = await page.evaluate(() => { window.gameTest.saveGame(); return JSON.parse(localStorage.getItem('kidsgame.slot.0')).quiz; });
    assert.deepEqual(kept, st);
    const all = await page.evaluate(() => Object.keys(localStorage).map(k => k + '=' + localStorage.getItem(k)).join('\n'));
    assert.ok(!/How many|What is|comes next|the most|Spell the word|"answers"|"letters"|"word"/.test(all), 'a question or an answer is stored on the device');
    // Nothing was sent anywhere: every request went to the game's own address or was a library file
    // (reading the owner's settings when the game opens sends nothing about the player: docs/EVENTS.md, part 6)
    const out = requests.filter(u => !u.startsWith('http://127.0.0.1') && !/cdn\.jsdelivr\.net/.test(u) && !u.startsWith('data:') && !u.startsWith('blob:') && !/\/rest\/v1\/game_settings\?/.test(u));
    assert.deepEqual(out, [], 'requests to other places');
    // The parent area (five taps in the top-left corner) shows the report
    const report = await page.evaluate(() => {
      const corner = [...document.body.children].find(d => d.style.width === '70px' && d.style.left === '0px');
      for (let i = 0; i < 5; i++) corner.click();
      const t = document.getElementById('quizReportTable');
      return t ? [...t.querySelectorAll('tr')].map(tr => [...tr.children].map(c => c.textContent)) : null;
    });
    assert.ok(report, 'the parent area does not show the quiz report');
    assert.deepEqual(report[0].slice(1, 5), ['Seen', 'Right first time', 'Right after a retry', 'Not finished']);
    assert.deepEqual(report[1].slice(0, 5), ['Maths', String(seen.math), '0', '1', String(seen.math - 1)]);
    assert.deepEqual(report[2].slice(0, 5), ['Words', String(seen.words), '1', '0', String(seen.words - 1)]);
    assert.deepEqual(report[3].slice(0, 5), ['All', String(seen.math + seen.words), '1', '1', String(seen.math + seen.words - 2)]);
    // Still there after closing and opening the game
    await page.reload({ waitUntil: 'domcontentloaded' });
    await playing(page);
    assert.deepEqual(await stats(), st, 'the report was not kept');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()], quiz: true }));

// ---- Hold a quick bar slot to fill it (0.6.68) ----
const slotEvent = (page, sel, type) => page.evaluate(([sel, type]) => document.querySelector(sel).dispatchEvent(new (type === 'click' ? MouseEvent : PointerEvent)(type, { bubbles: true, cancelable: true, pointerId: 11 })), [sel, type]);

test('holding a quick bar slot opens the bag for that slot, and the item tapped goes into it; a short press only selects the slot', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    const st = () => page.evaluate(() => ({ bag: window.gameTest.bagOpen, sel: window.gameTest.sel, qb: [...window.gameTest.qb], note: (document.getElementById('bagSlotNote') || {}).textContent || '' }));
    const before = await st();
    // A short press and release: the slot is selected, the bag stays closed
    await slotEvent(page, '#qb [data-slot="3"]', 'pointerdown');
    await slotEvent(page, '#qb [data-slot="3"]', 'pointerup');
    await slotEvent(page, '#qb [data-slot="3"]', 'click');
    await page.waitForTimeout(800);
    let s = await st();
    assert.deepEqual([s.bag, s.sel], [false, 3], 'a short press should only select the slot');
    // Held for more than half a second: the bag opens with that slot chosen
    await slotEvent(page, '#qb [data-slot="2"]', 'pointerdown');
    await page.waitForFunction(() => window.gameTest.bagOpen, null, { timeout: 5000 });
    s = await st();
    assert.equal(s.sel, 2, 'the held slot is chosen');
    assert.match(s.note, /quick bar slot 3\./);
    assert.equal(s.qb[2], null);
    await slotEvent(page, '#qb [data-slot="2"]', 'pointerup');
    await slotEvent(page, '#qb [data-slot="2"]', 'click');   // the click that ends the hold does nothing more
    s = await st();
    assert.deepEqual([s.bag, s.sel], [true, 2]);
    // One tap on an item in the bag puts it in that slot
    await page.evaluate(() => document.querySelector('#bag .row[data-item="dirt"]').click());
    s = await st();
    assert.equal(s.qb[2], 'dirt', 'the tapped item did not go into the held slot');
    assert.deepEqual([s.qb[0], s.qb[1], s.qb[3]], [before.qb[0], before.qb[1], before.qb[3]], 'other slots changed');
    assert.equal(await page.evaluate(() => window.gameTest.HOLD_MS), 500);
    // With Settings open, holding does nothing
    await page.keyboard.press('KeyB');
    await page.dispatchEvent('#settingsBtn', 'click');
    await page.evaluate(() => window.gameTest.holdOpensBag(4));
    s = await st();
    assert.deepEqual([s.bag, s.sel], [false, 2], 'holding worked with Settings open');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()] }));

test('on a touch screen, holding a hand button opens the bag for its slot; a quick tap only puts the item in the hand', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    const st = () => page.evaluate(() => ({ bag: window.gameTest.bagOpen, sel: window.gameTest.sel }));
    await slotEvent(page, '#bH2', 'pointerdown');
    await slotEvent(page, '#bH2', 'pointerup');
    await page.waitForTimeout(800);
    assert.deepEqual(await st(), { bag: false, sel: 1 }, 'a quick tap opened the bag');
    await slotEvent(page, '#bH1', 'pointerdown');
    await page.waitForFunction(() => window.gameTest.bagOpen, null, { timeout: 5000 });
    assert.deepEqual(await st(), { bag: true, sel: 0 });
    await slotEvent(page, '#bH1', 'pointerup');
    await page.evaluate(() => document.querySelector('#bag .row[data-item="dirt"]').click());
    assert.equal(await page.evaluate(() => window.gameTest.qb[0]), 'dirt', 'the tapped item did not go onto the hand button');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { device: TABLET, saves: [readyGame()] }));

// ---- Learning level (0.6.72, SPEC-004) ----
// Opens the parent area the way a parent does: five taps in the top-left corner
const openParentArea = page => page.evaluate(() => { const el = document.elementFromPoint(5, 5); for (let i = 0; i < 5; i++) el.click(); return !!document.querySelector('#learnLevel button'); });
const learnState = page => page.evaluate(() => {
  const el = document.getElementById('learnLevel');
  return { text: el.textContent, bands: [...el.querySelectorAll('[data-band]')].map(b => b.textContent.replace(/^\W+/, '')), chosen: [...el.querySelectorAll('[data-band]')].findIndex(b => b.getAttribute('aria-pressed') === 'true'),
    sliders: [...el.querySelectorAll('input[type=range]')].map(i => [i.dataset.sub, +i.min, +i.max, +i.value]), steps: el.querySelectorAll('[data-step]').length,
    typing: el.querySelectorAll('input:not([type=range]),textarea,select,[contenteditable]').length, restart: !!el.querySelector('#learnRestart'), levels: window.gameTest.quizLevels };
});
// A friend arrives with a question of one kind at the level in use; the panel is opened and described
const askAtLevel = async (page, kind) => {
  const a = await friendArrives(page);
  assert.equal(a.error, undefined, a.error);
  const q = await page.evaluate(kind => { const g = window.gameTest, sub = kind === 'word' ? 'words' : 'math'; return g.askQuiz(kind, g.quizLevels[sub].use); }, kind);
  const t = await pressFriend(page);
  assert.equal(t.open, true, 'the question did not open');
  const panel = await page.evaluate(() => { const p = document.getElementById('quizPanel'), img = p.querySelector('.qclue img');
    return { level: p.querySelector('.qlvl').textContent, text: p.querySelector('.qtext').textContent, answers: [...p.querySelectorAll('.qa')].map(b => b.textContent),
      img: img ? { src: img.getAttribute('src'), drawn: img.complete && img.naturalWidth > 0, w: img.getBoundingClientRect().width } : null,
      slots: [...p.querySelectorAll('.qs')].map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), Math.round(r.width)]; }),
      tiles: [...p.querySelectorAll('.qt')].map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), Math.round(r.width)]; }), width: innerWidth }; });
  return { q, panel };
};


test('learning level: three right first maths answers give "Maths level 16" with "Level up!", words stay at level 1, two wrong first answers make the questions easier without lowering the number, and the levels are kept in the saved game with nothing sent', { skip, timeout: 300000 }, () =>
  withGame(async (page, errors, requests) => {
    await playing(page);
    assert.deepEqual(await page.evaluate(() => window.gameTest.quizLevels), { band: 0, math: { use: 1, best: 1, fast: true, right: 0, wrong: 0 }, words: { use: 1, best: 1, fast: true, right: 0, wrong: 0 } });
    const ups = [];
    for (let i = 0; i < 3; i++) {
      const { q, panel } = await askAtLevel(page, 'add');
      assert.equal(panel.level, 'Maths level ' + (1 + i * 5));
      await clickAnswer(page, q.right);
      ups.push(await page.evaluate(() => document.querySelector('#quizPanel .qmsg').textContent));
      await quizClosed(page);
    }
    // Since 0.6.78 the question stays open after a right answer, and "Level up!" is said there, not in the line at the top
    assert.deepEqual(ups, ['Well done! +5 gems. Level up! Maths level 6', 'Well done! +5 gems. Level up! Maths level 11', 'Well done! +5 gems. Level up! Maths level 16']);
    // The next maths question shows level 16 and is a sum in figures within 20, with three answers and no pictures
    let a = await askAtLevel(page, 'add');
    assert.equal(a.panel.level, 'Maths level 16');
    assert.match(a.panel.text, /^What is \d+ \+ \d+\?$/);
    assert.equal(a.panel.answers.length, 3);
    assert.ok(Math.max(...a.panel.text.match(/\d+/g).map(Number), ...a.panel.answers.map(Number)) <= 30, 'numbers far outside 20: ' + a.panel.text);
    // Two wrong tries on it: one wrong answer is taken away as the hint. That is one wrong first answer.
    const wrong = [0, 1, 2].filter(i => i !== a.q.right);
    // (the game's own sound and picture files, from its own address, are not counted)
    const sent = () => requests.filter(u => !/^http:\/\/127\.0\.0\.1:\d+\/(audio|quiz\/pics|models)\//.test(u));
    const before = sent().length;
    await clickAnswer(page, wrong[0]); await clickAnswer(page, wrong[1]);
    assert.equal(await page.evaluate(() => document.querySelectorAll('#quizPanel .qa.out').length), 1, 'the hint did not take one wrong answer away');
    await clickAnswer(page, a.q.right);
    await quizClosed(page);
    assert.deepEqual(await page.evaluate(() => { const m = window.gameTest.quizLevels.math; return [m.use, m.best, m.fast, m.wrong]; }), [16, 16, false, 1]);
    // A second wrong first answer in a row: the level in use is 3 lower, the number the child sees is not
    a = await askAtLevel(page, 'take');
    await clickAnswer(page, [0, 1, 2].find(i => i !== a.q.right));
    await page.evaluate(() => window.gameTest.quizNotNow());
    assert.deepEqual(await page.evaluate(() => { const m = window.gameTest.quizLevels.math; return [m.use, m.best]; }), [13, 16]);
    assert.equal(sent().length, before, 'a request was made when a level changed: ' + sent().slice(before).join(', '));
    a = await askAtLevel(page, 'add');
    assert.equal(a.panel.level, 'Maths level 16', 'the number the child sees went down');
    await page.evaluate(() => window.gameTest.quizNotNow());
    // The word scramble still shows Words level 1, with a 3-letter word and its picture drawn from the game's own files
    a = await askAtLevel(page, 'word');
    assert.equal(a.panel.level, 'Words level 1');
    assert.equal(a.q.word.length, 3);
    assert.match(a.panel.img.src, /\/quiz\/pics\/[0-9a-f-]+\.svg$/);
    assert.equal(a.panel.img.drawn, true, 'the picture clue was not drawn');
    await page.evaluate(() => window.gameTest.quizNotNow());
    // Kept in the saved game, and still there after the game is closed and opened again
    const kept = await page.evaluate(() => { window.gameTest.saveGame(); return JSON.parse(localStorage.getItem('kidsgame.slot.0')).levels; });
    assert.deepEqual(kept, { band: 0, math: { use: 13, best: 16, fast: false, right: 0, wrong: 0 }, words: { use: 1, best: 1, fast: true, right: 0, wrong: 0 } });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await playing(page);
    assert.deepEqual(await page.evaluate(() => window.gameTest.quizLevels), kept, 'the levels were not there after reopening the game');
    const out = requests.filter(u => !u.startsWith('http://127.0.0.1') && !/cdn\.jsdelivr\.net/.test(u) && !u.startsWith('data:') && !u.startsWith('blob:') && !/\/rest\/v1\/game_settings\?/.test(u));   // (the owner's settings are only read: nothing about the player is sent)
    assert.deepEqual(out, [], 'requests to other places');
    assert.deepEqual(errors, [], errors.join('\n'));
  }, { saves: [readyGame()], quiz: true }));

test('learning level in the parent area: Auto and five bands, a level setter for each subject with no typing, and "Start levels again" that asks first', { skip, timeout: 300000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    assert.equal(await openParentArea(page), true, 'the parent area has no Learning level part');
    let s = await learnState(page);
    assert.match(s.text, /^Learning level/);
    assert.deepEqual(s.bands, ['Auto', 'Levels 1 to 20 (about ages 6 to 7)', 'Levels 21 to 40 (about ages 7 to 8)', 'Levels 41 to 60 (about ages 9 to 10)', 'Levels 61 to 80 (about ages 10 to 11)', 'Levels 81 to 100 (about ages 11 to 12)']);
    assert.equal(s.chosen, 0);
    assert.deepEqual(s.sliders, [['math', 1, 100, 1], ['words', 1, 100, 1]]);
    assert.equal(s.steps, 4, 'plus and minus buttons for both subjects');
    assert.equal(s.typing, 0, 'the parent area has a place to type a level');
    assert.equal(s.restart, true);
    assert.match(s.text, /Maths: level in use 1\. Your child sees level 1\./);
    // The slider sets maths to 40: the next maths question shows "Maths level 40"
    await page.evaluate(() => { const i = document.querySelector('#learnLevel input[data-sub="math"]'); i.value = '40'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
    s = await learnState(page);
    assert.deepEqual(s.levels.math, { use: 40, best: 40, fast: false, right: 0, wrong: 0 });
    assert.match(s.text, /Maths: level in use 40\. Your child sees level 40\./);
    // Plus and minus move one level
    await page.evaluate(() => { document.querySelector('#learnLevel [data-sub="words"][data-step="1"]').click(); document.querySelector('#learnLevel [data-sub="words"][data-step="1"]').click(); document.querySelector('#learnLevel [data-sub="words"][data-step="-1"]').click(); });
    assert.equal((await learnState(page)).levels.words.use, 2);
    await page.evaluate(() => document.getElementById('parentClose').click());
    let a = await askAtLevel(page, 'times');
    assert.equal(a.panel.level, 'Maths level 40');
    assert.match(a.panel.text, /^What is (2|5|10) × \d+\?$/);
    await page.evaluate(() => window.gameTest.quizNotNow());
    // "Levels 81 to 100": both levels come into the band; maths has a two-step sum and words have 7 letters and no picture
    await openParentArea(page);
    await page.evaluate(() => document.querySelector('#learnLevel [data-band="5"]').click());
    s = await learnState(page);
    assert.equal(s.chosen, 5);
    assert.deepEqual([s.levels.band, s.levels.math.use, s.levels.words.use, s.levels.words.best], [5, 81, 81, 81]);
    assert.deepEqual(s.sliders, [['math', 81, 100, 81], ['words', 81, 100, 81]]);
    await page.evaluate(() => document.getElementById('parentClose').click());
    a = await askAtLevel(page, 'twoStep');
    assert.equal(a.panel.level, 'Maths level 81');
    assert.match(a.panel.text, /^What is \d+ × \d+ [+−] \d+\?$/);
    await page.evaluate(() => window.gameTest.quizNotNow());
    a = await askAtLevel(page, 'word');
    assert.equal(a.panel.level, 'Words level 81');
    assert.ok(a.q.word.length >= 7, 'a short word at level 81: ' + a.q.word);
    assert.equal(a.panel.img, null, 'a word of 6 letters or more shows a picture');
    await page.evaluate(() => window.gameTest.quizNotNow());
    // "Levels 1 to 20": no word has more than 4 letters
    await openParentArea(page);
    await page.evaluate(() => document.querySelector('#learnLevel [data-band="1"]').click());
    assert.deepEqual(await page.evaluate(() => { const l = window.gameTest.quizLevels; return [l.band, l.math.use, l.words.use]; }), [1, 20, 20]);
    const longest = await page.evaluate(() => { const g = window.gameTest; let n = 0; for (let i = 0; i < 400; i++) { const q = g.nextQuestion(); if (q.kind === 'word') n = Math.max(n, q.word.length); } return n; });
    assert.equal(longest, 4);
    // "Start levels again" asks first; No keeps the levels, Yes sets both to the first level of the band
    await page.evaluate(() => document.getElementById('learnRestart').click());
    assert.match((await learnState(page)).text, /Are you sure\?/);
    await page.evaluate(() => document.getElementById('learnNo').click());
    assert.equal((await learnState(page)).levels.math.use, 20);
    await page.evaluate(() => { document.getElementById('learnRestart').click(); document.getElementById('learnYes').click(); });
    assert.deepEqual((await learnState(page)).levels, { band: 1, math: { use: 1, best: 1, fast: true, right: 0, wrong: 0 }, words: { use: 1, best: 1, fast: true, right: 0, wrong: 0 } });
    // Auto again, and the choice is in the saved game
    await page.evaluate(() => document.querySelector('#learnLevel [data-band="0"]').click());
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('kidsgame.slot.0')).levels.band), 0);
    // Nowhere is the child asked for an age: the only mention of ages on the page is in the parent area
    assert.equal(await page.evaluate(() => { document.getElementById('parentClose').click(); return /\bages?\b|birthday|school year|how old/i.test(document.body.innerText); }), false);
    assert.deepEqual(errors, [], errors.join('\n'));
  }, { saves: [readyGame()], quiz: true }));

for (const [name, device] of [['a phone held upright', { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true }], ['a phone held sideways', { viewport: { width: 740, height: 360 }, hasTouch: true, isMobile: true }]])
  test('learning level on ' + name + ': a 5-letter word shows its picture, a 6-letter word shows none, and an 8-letter word fits the screen', { skip, timeout: 300000 }, () =>
    withGame(async (page, errors) => {
      await playing(page);
      for (const [level, letters] of [[45, 5], [55, 6], [100, 8]]) {
        await page.evaluate(level => window.gameTest.setQuizLevels({ band: 0, math: { use: 1, best: 1 }, words: { use: level, best: level, fast: false } }), level);
        let a = null;
        for (let tries = 0; tries < 12; tries++) {   // (one word in four comes from the row below)
          a = await askAtLevel(page, 'word');
          if (a.q.word.length === letters) break;
          await page.evaluate(() => window.gameTest.quizNotNow());
        }
        assert.equal(a.q.word.length, letters);
        assert.equal(a.panel.level, 'Words level ' + level);
        if (letters <= 5) { assert.equal(a.panel.img.drawn, true, 'the picture of ' + a.q.word + ' was not drawn'); assert.ok(a.panel.img.w >= 56, 'the picture is too small'); }
        else assert.equal(a.panel.img, null, a.q.word + ' shows a picture');
        assert.equal(a.panel.slots.length, letters);
        for (const [l, r] of [...a.panel.slots, ...a.panel.tiles]) assert.ok(l >= 0 && r <= a.panel.width, 'a letter is off the screen: ' + l + ' to ' + r + ' of ' + a.panel.width);
        for (const [, , w] of a.panel.tiles) assert.ok(w >= 48, 'a letter tile is smaller than 48 px: ' + w);
        const box = await page.evaluate(() => { const b = document.querySelector('#quizPanel .qbox').getBoundingClientRect(), n = document.querySelector('#quizPanel .qnot').getBoundingClientRect(); return { fits: b.top >= 0 && b.bottom <= innerHeight + 1, scroll: document.querySelector('#quizPanel .qbox').scrollHeight > document.querySelector('#quizPanel .qbox').clientHeight + 1, notNow: n.height }; });
        assert.ok(box.fits, 'the question does not fit the screen');
        // spell it: the long word can be finished with taps alone
        const r = await spell(page);
        assert.match(r.msg, /Well done! \+5 gems/);
        await quizClosed(page);
      }
      assert.deepEqual(errors, [], errors.join('\n'));
    }, { device, saves: [readyGame()], quiz: true }));

// ---- Vital the elephant, your guide (0.6.73, SPEC-011) ----
// One second of play, many times over, with no monsters about; o.walk: the character is moving
const playSeconds = (page, secs, o = {}) => page.evaluate(([secs, o]) => {
  const g = window.gameTest;
  // walking: W for a second, then S for a second, so the character keeps moving and stays near where it was
  const key = (type, code) => dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
  let done = secs;
  for (let s = 0; s < secs; s++) {
    if (!o.monsters) g.clearEnemies();
    if (o.walk) { key('keyup', s % 2 ? 'KeyW' : 'KeyS'); key('keydown', s % 2 ? 'KeyS' : 'KeyW'); }
    g.stepFrames(Array(20).fill(0.05));
    if (o.untilFriend && g.friend) { done = s + 1; break; }
  }
  if (o.walk) { key('keyup', 'KeyW'); key('keyup', 'KeyS'); g.stepFrames([0.05]); }
  return done;
}, [secs, o]);
const tipState = page => page.evaluate(() => { const g = window.gameTest, p = document.getElementById('tipPanel');
  return { open: g.tipOpen, text: g.tipText, buttons: p ? [...p.querySelectorAll('button')].map(b => b.textContent) : [], typing: p ? p.querySelectorAll('input,textarea,select,[contenteditable]').length : 0,
    paused: g.paused, friend: g.friend, vital: g.vital, visit: g.vitalVisit, msg: g.msg, kept: localStorage.getItem('kidsgame.vital') }; });
const tapTip = (page, cls) => page.evaluate(cls => document.querySelector('#tipPanel .' + cls).click(), cls);
// Lets Vital walk up, then taps him
const meetVital = async page => {
  await page.evaluate(() => { const g = window.gameTest; for (let s = 0; s < 8; s++) { g.clearEnemies(); g.stepFrames(Array(20).fill(0.05)); } });
  const t = await pressFriend(page);
  assert.equal(t.error, undefined, t.error);
  return tipState(page);
};
// Vital leaves: a wave, then he walks off and is gone
const vitalGone = page => page.evaluate(() => { const g = window.gameTest; for (let s = 0; s < 8 && g.friend; s++) g.stepFrames(Array(20).fill(0.05)); return g.friend === null; });

test('Vital comes within 5 seconds for a new player, with "!" and his name; a tap shows the first tip with "OK" and "No more tips"; after OK he leaves, a quiz friend waits 20 seconds, and he is back with the walking tip after 2 minutes of walking', { skip, timeout: 300000 }, () =>
  withGame(async (page, errors, requests) => {
    await playing(page);
    const secs = await playSeconds(page, 6, { monsters: true, untilFriend: true });
    let s = await tipState(page);
    assert.ok(secs <= 5, 'Vital did not come within 5 seconds: ' + secs);
    assert.equal(s.friend && s.friend.kind, 'vital', 'the first to come is not Vital');
    assert.equal(s.friend.guide, true);
    assert.equal(s.friend.bubble, true);
    assert.equal(s.msg, 'Vital is here! Tap him to say hello.');
    assert.equal(s.open, false, 'the tip opened by itself');
    s = await meetVital(page);
    assert.equal(s.open, true, 'a tap on Vital did not open the tip');
    assert.equal(s.text, 'Hi! I am Vital. I can show you how to play.');
    assert.deepEqual(s.buttons, ['OK', 'No more tips']);
    assert.equal(s.typing, 0);
    assert.equal(s.paused, true, 'the game does not stand still while the tip is open');
    const sizes = await page.evaluate(() => { const r = c => document.querySelector('#tipPanel .' + c).getBoundingClientRect(); return { ok: r('tok').height, no: r('tno').height, okW: r('tok').width, noW: r('tno').width }; });
    assert.ok(sizes.ok >= 60 && sizes.no >= 48 && sizes.ok > sizes.no && sizes.okW > sizes.noW, 'OK is not the big button: ' + JSON.stringify(sizes));
    // (the game's own loop does not run while `paused` is set, so nothing moves while the panel is open)
    const sent = requests.length;
    await tapTip(page, 'tok');
    s = await tipState(page);
    assert.equal(s.open, false);
    assert.equal(s.vital.seen, 1, 'the tip was not counted as seen');
    assert.equal(s.friend.state, 'leave');
    assert.equal(requests.filter(u => !/\/audio\//.test(u)).length, requests.slice(0, sent).filter(u => !/\/audio\//.test(u)).length, 'a request was made when a tip was shown');
    assert.equal(await vitalGone(page), true, 'Vital did not leave');
    // The first quiz friend comes 20 seconds after Vital has left, not sooner
    assert.equal(await page.evaluate(() => Math.round(window.gameTest.friendWait)), 20);
    assert.equal(await playSeconds(page, 18, { untilFriend: true }), 18, 'a quiz friend came sooner than 20 seconds after Vital left');
    await playSeconds(page, 6, { untilFriend: true });
    s = await tipState(page);
    assert.ok(s.friend && !s.friend.guide, 'no quiz friend came after Vital left');
    // No Vital while a quiz friend is on screen, even when his wait is over
    await page.evaluate(() => window.gameTest.setVitalWait(0));
    await playSeconds(page, 3, { walk: true });
    assert.equal((await tipState(page)).friend.guide, false);
    // Standing still, he does not come back; after 2 minutes of walking he does, with the walking tip in keyboard wording
    await page.evaluate(() => { window.gameTest.setVitalWait(120); window.gameTest.removeFriend(); window.gameTest.setFriendWait(9999); });
    await playSeconds(page, 30);
    assert.equal((await tipState(page)).friend, null, 'Vital came back while the child stood still');
    const walked = await playSeconds(page, 130, { walk: true, untilFriend: true });
    assert.ok(walked >= 115 && walked <= 125, 'Vital came back after ' + walked + ' seconds of walking, not about 2 minutes');
    s = await meetVital(page);
    assert.equal(s.text, 'Use W A S D to walk. Press Space to jump.');
    // Esc leaves the tip unseen; he waits 20 seconds more, then leaves
    await page.keyboard.press('Escape');
    s = await tipState(page);
    assert.deepEqual([s.open, s.vital.seen, Math.round(s.friend.age)], [false, 1, 70]);
    await playSeconds(page, 30);
    assert.equal((await tipState(page)).friend, null, 'Vital did not leave after the tip was closed');
    assert.deepEqual(JSON.parse((await tipState(page)).kept), { on: true, seen: 1, ask: false, skip: 0 });
    const out = requests.filter(u => !u.startsWith('http://127.0.0.1') && !/cdn\.jsdelivr\.net/.test(u) && !u.startsWith('data:') && !u.startsWith('blob:') && !/\/rest\/v1\/game_settings\?/.test(u));   // (the owner's settings are only read: nothing about the player is sent)
    assert.deepEqual(out, [], 'requests to other places');
    assert.deepEqual(errors, [], errors.join('\n'));
  }, { saves: [readyGame()], quiz: true, vital: true }));

test('after "No more tips" Vital stays away for the rest of the visit and the next two; on the third he asks "Do you want tips?", and "Yes" shows the next unseen tip', { skip, timeout: 300000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    await playSeconds(page, 6, { untilFriend: true });
    let s = await meetVital(page);
    assert.equal(s.open, true);
    await tapTip(page, 'tno');
    s = await tipState(page);
    assert.equal(s.msg, 'OK! I will say hello another day.');
    assert.deepEqual([s.open, s.vital.seen, s.vital.ask, s.vital.skip, s.visit.due], [false, 0, true, 2, false]);
    await vitalGone(page);
    await page.evaluate(() => { window.gameTest.setFriendWait(9999); window.gameTest.setVitalWait(0); });
    await playSeconds(page, 200, { walk: true });
    assert.equal((await tipState(page)).friend, null, 'Vital came back in the same visit');
    // The next two visits: he does not come, and the quiz friend comes at 3 seconds as before
    for (const left of [1, 0]) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await playing(page);
      await playSeconds(page, 6, { untilFriend: true });
      s = await tipState(page);
      assert.ok(s.friend && !s.friend.guide, 'Vital came in a visit he should stay away for');
      assert.deepEqual([s.vital.ask, s.vital.skip], [true, left]);
    }
    // The third visit: he asks; closing the question keeps him asking next time; "Yes" shows the first unseen tip
    await page.reload({ waitUntil: 'domcontentloaded' });
    await playing(page);
    await playSeconds(page, 6, { untilFriend: true });
    s = await meetVital(page);
    assert.equal(s.friend.kind, 'vital');
    assert.equal(s.text, 'Hi again! Do you want tips?');
    assert.deepEqual(s.buttons, ['Yes', 'Not now']);
    await tapTip(page, 'tyes');
    s = await tipState(page);
    assert.equal(s.text, 'Hi! I am Vital. I can show you how to play.');
    assert.deepEqual([s.vital.ask, s.vital.skip], [false, 0]);
    await tapTip(page, 'tok');
    assert.equal((await tipState(page)).vital.seen, 1);
    await vitalGone(page);
    // "Not now" sends him away for another three visits; with every tip seen he asks, and "Yes" gives one tip again
    await page.evaluate(() => window.gameTest.setVital({ on: true, seen: 12, ask: true, skip: 0 }));
    await page.evaluate(() => { window.gameTest.removeFriend(); window.gameTest.setFriendWait(9999); });
    await playSeconds(page, 6, { untilFriend: true });
    s = await meetVital(page);
    assert.equal(s.text, 'Hi again! Do you want tips?');
    await tapTip(page, 'tyes');
    s = await tipState(page);
    assert.ok(await page.evaluate(t => window.gameTest.VITAL_TIPS.some(tip => tip.includes(t)), s.text), 'not one of the twelve tips: ' + s.text);
    await tapTip(page, 'tok');
    s = await tipState(page);
    assert.deepEqual([s.vital.seen, s.vital.ask, s.vital.skip], [12, true, 2]);
    await vitalGone(page);
    await page.evaluate(() => window.gameTest.setVital({ on: true, seen: 3, ask: true, skip: 0 }));
    await playSeconds(page, 6, { untilFriend: true });
    await meetVital(page);
    await tapTip(page, 'tnot');
    s = await tipState(page);
    assert.deepEqual([s.open, s.vital.seen, s.vital.ask, s.vital.skip, s.visit.due], [false, 3, true, 2, false]);
    assert.deepEqual(errors, [], errors.join('\n'));
  }, { saves: [readyGame()], quiz: true, vital: true }));

test('Vital on a phone: touch wording, at most 4 visits from him in one visit, never while a panel is open; he cannot be dug under; with "Tips from Vital" off he never comes, and the switch is remembered', { skip, timeout: 300000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    await page.evaluate(() => window.gameTest.setFriendWait(9999));
    await playSeconds(page, 6, { untilFriend: true });
    let s = await meetVital(page);
    assert.equal(s.text, 'Hi! I am Vital. I can show you how to play.');
    const fit = await page.evaluate(() => { const b = document.querySelector('#tipPanel .tbox').getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight; });
    assert.ok(fit, 'the tip does not fit the phone screen');
    // he stands on a block that cannot be dug or built into
    assert.equal(await page.evaluate(() => { const g = window.gameTest, f = g.friend; return g.friendOn(Math.floor(f.x), Math.floor(f.y + 0.5) - 1, Math.floor(f.z)); }), true);
    await tapTip(page, 'tok');
    await vitalGone(page);
    const texts = [];
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.gameTest.setVitalWait(0));
      await playSeconds(page, 4, { walk: true, untilFriend: true });
      s = await meetVital(page);
      texts.push(s.text);
      await tapTip(page, 'tok');
      await vitalGone(page);
    }
    assert.deepEqual(texts, ['Push the thumb stick to walk. Tap JUMP to jump.', 'Drag sideways with a finger to turn the view.', 'Choose the pickaxe. Hold a finger on a block to dig it.']);
    // four visits from him: no fifth in this visit
    await page.evaluate(() => window.gameTest.setVitalWait(0));
    await playSeconds(page, 10, { walk: true });
    s = await tipState(page);
    assert.deepEqual([s.friend, s.visit.came, s.vital.seen], [null, 4, 4]);
    // a new visit: not while a monster is within 10 blocks (after the start of the visit), and not while a panel is open
    await page.evaluate(() => { const g = window.gameTest; g.setVital({ on: true, seen: 4, ask: false, skip: 0 }); g.setFriendWait(9999); });
    await playSeconds(page, 6, { untilFriend: true });
    await meetVital(page); await tapTip(page, 'tok'); await vitalGone(page);
    await page.dispatchEvent('#settingsBtn', 'click');
    const blocked = await page.evaluate(() => { const g = window.gameTest; g.setVitalWait(0); g.clearEnemies(); for (let s = 0; s < 3; s++) { g.walkAway(0.3); g.stepFrames(Array(20).fill(0.05)); } return g.friend; });
    assert.equal(blocked, null, 'Vital came while Settings was open');
    // the Settings switch: on at first; off, he never comes; remembered after closing and reopening
    assert.equal(await page.evaluate(() => window.gameTest.vitalVisit.wait <= 0), true);
    assert.equal(await page.evaluate(() => document.getElementById('vitalSwitch').textContent), 'On');
    await page.dispatchEvent('#vitalSwitch', 'click');
    assert.equal(await page.evaluate(() => document.getElementById('vitalSwitch').textContent), 'Off');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.gameTest.settingsOpen), false, 'Settings did not close');
    await page.evaluate(() => window.gameTest.setVitalWait(0));
    await playSeconds(page, 20, { walk: true });
    assert.equal((await tipState(page)).friend, null, 'Vital came with his tips switched off');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await playing(page);
    await page.evaluate(() => window.gameTest.setFriendWait(9999));
    await playSeconds(page, 10, { walk: true });
    s = await tipState(page);
    assert.deepEqual([s.friend, s.vital.on, s.vital.seen], [null, false, 5], 'the switch or the tips seen were not remembered');
    assert.deepEqual(errors, [], errors.join('\n'));
  }, { device: { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true }, saves: [readyGame()], quiz: true, vital: true }));

// ---- SPEC-016, release 1 (0.6.74): the fireball flies where you tap (A), sword reach (B), digging by hand (C), powers in a menu (H) ----
// A tap (press and release) on the world at a screen point, with a finger or the mouse; `drag` moves the pointer before the release
const tapWorld = (page, x, y, opts = {}) => page.evaluate(({ x, y, o }) => {
  const c = document.querySelector('body > canvas');
  const ev = (t, dx = 0) => c.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: x + dx, clientY: y, pointerId: 9, button: 0, pointerType: o.touch ? 'touch' : 'mouse' }));
  ev('pointerdown');
  if (o.drag) ev('pointermove', o.drag);
  if (!o.keep) ev('pointerup');
}, { x, y, o: opts });
// Do two boxes on the screen overlap?
const BOXES_FN = `(ids => { const out = []; const r = id => { const el = document.getElementById(id); const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 ? b : null; };
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const a = r(ids[i]), b = r(ids[j]); if (a && b && a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5) out.push(ids[i] + ' on ' + ids[j]); } return out; })`;

test('SPEC-016 A: a tap in the middle of the Spell button lights it up even with six rows in the Recent list, and the list never covers a button', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    await page.waitForFunction(() => getComputedStyle(document.getElementById('bSpell')).display !== 'none', null, { timeout: 60000 });
    // Six things in the Recent list, and the quick bar open (on a phone the list shows with the quick bar)
    await page.evaluate(() => { const g = window.gameTest; for (const id of ['dirt', 'stone', 'gem', 'goblin_ear', 'imp_horn', 'brute_tooth']) g.addItem(id, 1); });
    await page.dispatchEvent('#hudBtn', 'click');
    const sizes = [[320, 360], [360, 640], [360, 780], [640, 360], [780, 360], [800, 480], [1024, 600], [1280, 609], [1920, 1080]];
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      await page.evaluate(() => window.gameTest.stepFrames([0.016]));
      const r = await page.evaluate(`({ over: ${BOXES_FN}(['recent', 'bSpell', 'bH1', 'bH2', 'bJ', 'qb', 'bagBtn', 'settingsBtn', 'toggle', 'teleBtn', 'powersBtn', 'hudBtn', 'stick']),
        recent: document.getElementById('recent').getClientRects().length > 0, rows: [...document.querySelectorAll('#recent .row')].filter(e => e.getClientRects().length).length,
        spell: (() => { const b = document.getElementById('bSpell').getBoundingClientRect(); const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!el && !!el.closest('#bSpell'); })(),
        powers: document.getElementById('powersBtn').getBoundingClientRect().height })`);
      assert.deepEqual(r.over.filter(o => /recent|powersBtn|bSpell/.test(o)), [], `at ${w} x ${h} nothing lies on the Recent list, the Spell button or the Powers button: ` + r.over.join(', '));
      assert.ok(r.spell, `at ${w} x ${h} the middle of the Spell button is the Spell button`);
      assert.ok(!r.recent || r.rows >= 2, `at ${w} x ${h} the Recent list shows two rows or more, or is not on the screen (rows: ${r.rows})`);
      assert.ok(r.powers >= 44, `at ${w} x ${h} the Powers button is at least 44 px tall (${r.powers})`);
      if (w < 400) assert.equal(r.recent, false, `at ${w} px wide the Recent list is not on the screen`);
    }
    // The real tap, on a wide phone held sideways
    await page.setViewportSize({ width: 780, height: 360 });
    await page.evaluate(() => window.gameTest.stepFrames([0.016]));
    const before = await page.evaluate(() => ({ qb: window.gameTest.qb.slice(), balls: window.gameTest.fireballs.length }));
    const box = await page.evaluate(() => { const b = document.getElementById('bSpell').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
    await page.touchscreen.tap(box[0], box[1]);
    const after = await page.evaluate(() => ({ qb: window.gameTest.qb.slice(), balls: window.gameTest.fireballs.length, armed: window.gameTest.spellArmed, msg: window.gameTest.msg, lit: document.getElementById('bSpell').classList.contains('on') }));
    assert.ok(after.armed && after.lit, 'the Spell button lights up');
    assert.equal(after.msg, 'Tap where the fireball should go.');
    assert.equal(after.balls, before.balls, 'nothing is cast yet');
    assert.deepEqual(after.qb, before.qb, 'nothing is added to the quick bar');
    // 360 px wide: the list is at the top of the bag and not on the screen
    await page.setViewportSize({ width: 360, height: 780 });
    await page.evaluate(() => { window.gameTest.armSpell(false); window.gameTest.stepFrames([0.016]); });
    await page.dispatchEvent('#bagBtn', 'click');
    const bag = await page.evaluate(() => ({ onScreen: document.getElementById('recent').getClientRects().length > 0, open: window.gameTest.bagOpen,
      rows: document.querySelectorAll('#bagRecent [data-item]').length, first: !!document.querySelector('#bag .title') && document.querySelector('#bag .title').textContent,
      aboveAll: document.getElementById('bagRecent').getBoundingClientRect().top < document.getElementById('bagAll').getBoundingClientRect().top }));
    assert.ok(bag.open, 'the bag is open');
    assert.equal(bag.onScreen, false, 'the Recent list is not on a 360 px screen');
    assert.equal(bag.rows, 6, 'the bag shows the six recent things');
    assert.equal(bag.first, 'Recent');
    assert.ok(bag.aboveAll, 'the Recent list is at the top of the bag');
    // A tap on a recent row in the bag puts the item in the chosen slot, as the list on the screen does
    await page.evaluate(() => { window.gameTest.selectSlot(4); document.querySelector('#bagRecent [data-item="stone"]').click(); });
    assert.equal(await page.evaluate(() => window.gameTest.qb[4]), 'stone');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { device: PHONE_WIDE, saves: [spellGame()] }));

test('SPEC-016 A: after a tap on the Spell button, a tap on a monster to one side sends the fireball to that monster; a tap on the ground lands it there; a drag casts nothing', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    await page.waitForFunction(() => getComputedStyle(document.getElementById('bSpell')).display !== 'none', null, { timeout: 60000 });
    const arm = () => pressOn(page, '#bSpell');
    // A goblin to one side, further away than a sword reaches
    const m = await page.evaluate(() => {
      const g = window.gameTest;
      g.setYaw(0); g.settleCamera(); g.clearEnemies();
      for (const [dx, dz] of [[5, -6], [-5, -6], [4, -7], [-4, -7], [6, -5]]) {
        if (!g.enemyNear('goblin', dx, dz)) continue;
        const en = g.enemies[g.enemies.length - 1];
        const [sx, sy, front] = g.screenOf(en);
        if (front && sx > 20 && sx < innerWidth - 120 && sy > 60 && sy < innerHeight - 20 && g.enemyAt(sx, sy) === en && document.elementFromPoint(sx, sy) === document.querySelector('body > canvas')) return { sx, sy, dx, dz, gap: g.swordGap(en) };
        g.clearEnemies();
      }
      return { error: 'no goblin could be put to one side on the screen' };
    });
    assert.equal(m.error, undefined, m.error);
    assert.ok(m.gap > 2, 'the goblin is out of sword reach');
    // Lit button, then a drag: nothing is cast and the button stays lit
    await arm();
    assert.equal(await page.evaluate(() => window.gameTest.spellArmed), true);
    const n0 = await page.evaluate(() => window.gameTest.fireballs.length);
    await tapWorld(page, m.sx, m.sy, { touch: true, drag: 60 });
    let st = await page.evaluate(() => ({ armed: window.gameTest.spellArmed, balls: window.gameTest.fireballs.length }));
    assert.equal(st.balls, n0, 'a drag casts nothing');
    assert.equal(st.armed, true, 'a drag leaves the button lit');
    // The tap on the monster: one fireball, flying toward it, and the button goes dark. No sword hit and no digging.
    await page.evaluate(() => { window.gameTest.setYaw(0); window.gameTest.settleCamera(); });
    const hp0 = await page.evaluate(() => window.gameTest.enemies[0].hp);
    await tapWorld(page, m.sx, m.sy, { touch: true });
    const shot = await page.evaluate(() => {
      const g = window.gameTest, f = g.fireballs[g.fireballs.length - 1], en = g.enemies[0], [px, py, pz] = g.pos;
      if (!f) return null;
      const to = [en.x - px, en.z - pz], l = Math.hypot(...to), v = Math.hypot(f.vx, f.vz);
      return { homing: f.homing === en, toward: (f.vx * to[0] + f.vz * to[1]) / (l * v), armed: g.spellArmed, hp: en.hp, digging: !!g.digging, fight: !!g.fight };
    });
    assert.ok(shot, 'a fireball is cast');
    assert.ok(shot.homing, 'the fireball follows the tapped monster');
    assert.ok(shot.toward > 0.95, 'the fireball flies toward the monster, not straight ahead: ' + shot.toward);
    assert.equal(shot.armed, false, 'the button goes dark after the cast');
    assert.equal(shot.hp, hp0, 'the tap itself does not hit with the sword');
    assert.ok(!shot.digging && !shot.fight, 'the tap does not dig or fight');
    const hit = await page.evaluate(() => { const g = window.gameTest; const hp = g.enemies[0] ? g.enemies[0].hp : 0; g.stepFrames(Array(60).fill(0.05)); return { hp, now: g.enemies[0] ? g.enemies[0].hp : 0 }; });
    assert.ok(hit.now < hit.hp, 'the fireball hits that monster');
    // A tap on the ground far to the left: the fireball flies there
    await page.evaluate(() => { const g = window.gameTest; g.clearEnemies(); g.setYaw(0); g.settleCamera(); g.stepFrames(Array(12).fill(0.05)); g.clearEnemies(); });
    await arm();
    const gx = 60, gy = await page.evaluate(() => Math.round(innerHeight * 0.62));
    await tapWorld(page, gx, gy, { touch: true });
    const ground = await page.evaluate(() => {
      const g = window.gameTest, f = g.fireballs[g.fireballs.length - 1], s = g.lastShot;
      if (!f || !s || !s.aimPoint) return null;
      const to = [s.aimPoint[0] - s.origin[0], s.aimPoint[1] - s.origin[1], s.aimPoint[2] - s.origin[2]], l = Math.hypot(...to), v = Math.hypot(f.vx, f.vy, f.vz);
      const ahead = g.viewDir ? null : null;
      return { toward: (f.vx * to[0] + f.vy * to[1] + f.vz * to[2]) / (l * v), left: to[0], armed: g.spellArmed };
    });
    assert.ok(ground, 'a fireball is cast at the ground');
    assert.ok(ground.toward > 0.99, 'the fireball flies to the tapped place: ' + ground.toward);
    assert.ok(ground.left < -2, 'the place is to the left of the character, not straight ahead: ' + ground.left);
    assert.equal(ground.armed, false);
    // A second tap on the button turns it off; so do 5 seconds with no tap on the world
    await page.evaluate(() => window.gameTest.stepFrames(Array(12).fill(0.05)));
    await arm(); await arm();
    assert.equal(await page.evaluate(() => window.gameTest.spellArmed), false, 'a second tap on the button turns it off');
    await arm();
    const timed = await page.evaluate(() => { const g = window.gameTest, n = g.fireballs.length; g.ageSpell(g.SPELL_ARM_MS + 100); g.stepFrames([0.016]); return { armed: g.spellArmed, cast: g.fireballs.length - n }; });
    assert.deepEqual(timed, { armed: false, cast: 0 }, 'after 5 seconds the button goes dark and nothing is cast');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { device: PHONE_WIDE, saves: [spellGame()] }));

test('SPEC-016 A: on a computer the F key casts toward the mouse pointer', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    const m = await page.evaluate(() => {
      const g = window.gameTest;
      g.setYaw(0); g.settleCamera(); g.clearEnemies();
      for (const [dx, dz] of [[5, -6], [-5, -6], [4, -7], [-4, -7]]) {
        if (!g.enemyNear('goblin', dx, dz)) continue;
        const en = g.enemies[g.enemies.length - 1];
        const [sx, sy, front] = g.screenOf(en);
        if (front && sx > 20 && sx < innerWidth - 20 && sy > 60 && sy < innerHeight - 90 && g.enemyAt(sx, sy) === en) return { sx, sy };
        g.clearEnemies();
      }
      return { error: 'no goblin could be put to one side on the screen' };
    });
    assert.equal(m.error, undefined, m.error);
    await page.mouse.move(m.sx, m.sy);
    await page.evaluate(() => { window.gameTest.setYaw(0); window.gameTest.settleCamera(); });
    await page.keyboard.press('KeyF');
    const shot = await page.evaluate(() => { const g = window.gameTest, f = g.fireballs[g.fireballs.length - 1]; return f ? { homing: f.homing === g.enemies[0] } : null; });
    assert.ok(shot && shot.homing, 'F casts a fireball at the monster under the mouse pointer');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { device: PC, saves: [spellGame()] }));

test('SPEC-016 B: a sword hits only from 2 blocks or closer, a bigger monster from a little further; the fireball and digging keep their reach', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    // Puts one monster dz blocks in front and returns a screen point on it
    const put = (kind, dz) => page.evaluate(({ kind, dz }) => {
      const g = window.gameTest;
      g.setYaw(0); g.settleCamera(); g.clearEnemies();
      for (const dx of [0, 1, -1]) {
        if (!g.enemyNear(kind, dx, dz)) continue;
        const en = g.enemies[g.enemies.length - 1];
        const [sx, sy] = g.screenOf(en);
        for (const oy of [0, -10, 10, -20, 20, -30]) for (const ox of [0, -8, 8]) { const a = g.aimAt(sx + ox, sy + oy); if (a && a.enemy === en) return { x: sx + ox, y: sy + oy, gap: g.swordGap(en), hp: en.hp }; }
        g.clearEnemies();
      }
      return { error: 'no ' + kind + ' could be put under the pointer at ' + dz };
    }, { kind, dz });
    const state = () => page.evaluate(() => { const g = window.gameTest, en = g.enemies[0]; return { hp: en ? en.hp : 0, msg: g.msg, fight: !!g.fight, balls: g.fireballs.length }; });
    await page.evaluate(() => window.gameTest.selectSlot(1));   // the sword is in hand
    assert.equal(await page.evaluate(() => window.gameTest.SWORD_REACH), 2);
    // Next to the monster: the tap hits
    let m = await put('goblin', -1);
    assert.equal(m.error, undefined, m.error);
    await tapWorld(page, m.x, m.y);
    // (how much one hit takes off depends on the Fighting level of the saved game: here the hit only has to land)
    assert.ok((await state()).hp < m.hp, 'next to a monster the sword hits it');
    // 5 blocks away: no hit, and the game says so
    await page.evaluate(() => window.gameTest.stepFrames(Array(10).fill(0.05)));
    m = await put('goblin', -5);
    assert.equal(m.error, undefined, m.error);
    assert.ok(m.gap > 2);
    await tapWorld(page, m.x, m.y);
    let s = await state();
    assert.equal(s.hp, m.hp, '5 blocks away the sword does not hit');
    assert.equal(s.msg, 'Too far away! Get closer.');
    // Holding: the hits stop when the character walks back more than 2 blocks
    m = await put('brute', -1);
    assert.equal(m.error, undefined, m.error);
    await tapWorld(page, m.x, m.y, { keep: true });
    assert.equal((await state()).fight, true, 'holding on a close monster keeps hitting');
    const walked = await page.evaluate(() => { const g = window.gameTest, en = g.enemies[0]; g.walkAway(4); const gap = g.swordGap(en); g.stepFrames([0.05]); return { gap, fight: !!g.fight }; });
    assert.ok(walked.gap > 2 && !walked.fight, 'walking back more than 2 blocks stops the hits: ' + JSON.stringify(walked));
    await page.evaluate(() => document.querySelector('body > canvas').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9 })));
    // A bigger monster can be reached from a little further away than a smaller one at the same spot
    const gaps = await page.evaluate(() => {
      const g = window.gameTest, [px, py, pz] = g.pos, out = {};
      for (const kind of ['goblin', 'brute']) { g.clearEnemies(); g.enemyNear(kind, 0, 0); const en = g.enemies[0]; en.x = px + 2.5; en.z = pz; en.y = py; out[kind] = g.swordGap(en); }
      g.clearEnemies();
      return out;
    });
    assert.ok(gaps.brute < gaps.goblin, 'the bigger monster is nearer to the sword: ' + JSON.stringify(gaps));
    assert.ok(gaps.brute <= 2 && gaps.goblin > 2, 'at 2.5 blocks a Brute is in reach and a Goblin is not: ' + JSON.stringify(gaps));
    // The fireball still reaches a monster 15 blocks away (the lit Spell button, on-screen controls on)
    await page.evaluate(() => { document.getElementById('toggle').click(); });
    await page.waitForFunction(() => getComputedStyle(document.getElementById('bSpell')).display !== 'none', null, { timeout: 30000 });
    const far = await page.evaluate(() => {
      const g = window.gameTest;
      g.setYaw(0); g.settleCamera(); g.clearEnemies();
      if (!g.enemyNear('goblin', 0, -15)) return { error: 'no far goblin' };
      const en = g.enemies[0], [sx, sy, front] = g.screenOf(en);
      return { sx, sy, front, at: g.enemyAt(sx, sy) === en };
    });
    assert.equal(far.error, undefined, far.error);
    assert.ok(far.front && far.at, 'the far goblin is on the screen');
    await pressOn(page, '#bSpell');
    await tapWorld(page, far.sx, far.sy);
    const cast = await page.evaluate(() => { const g = window.gameTest, f = g.fireballs[g.fireballs.length - 1]; return !!f && f.homing === g.enemies[0]; });
    assert.ok(cast, 'a fireball is cast at a monster 15 blocks away');
    // Digging reach is unchanged: a block about 6 blocks away can still be dug
    assert.equal(await page.evaluate(() => window.gameTest.reach), 7);
    const dig = await page.evaluate(() => {
      const g = window.gameTest;
      g.clearEnemies(); g.selectSlot(0); g.setYaw(0); g.settleCamera();
      for (let y = Math.round(innerHeight * 0.75); y > innerHeight * 0.2; y -= 6) for (let x = Math.round(innerWidth * 0.3); x < innerWidth * 0.7; x += 10) {
        if (document.elementFromPoint(x, y) !== document.querySelector('body > canvas')) continue;
        const c = g.aimAt(x, y);
        if (c && !c.enemy && c.dist > 5.5 && c.dist <= 7 && g.isSolid(g.blockAt(...c.dig))) return { x, y, dist: c.dist };
      }
      return { error: 'no block about 6 blocks away was found on the screen' };
    });
    assert.equal(dig.error, undefined, dig.error);
    await tapWorld(page, dig.x, dig.y, { keep: true });
    assert.equal(await page.evaluate(() => !!window.gameTest.digging), true, 'a block ' + dig.dist.toFixed(1) + ' blocks away can still be dug');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { device: PC, saves: [spellGame()] }));

test('SPEC-016 C: every block can be dug by hand, more slowly than with the pickaxe, and digging by hand wears out nothing', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    // Holds on a close block until it is dug (or 15 seconds pass). Returns the seconds it took and what was said at the start.
    const digOne = (slot, stone) => page.evaluate(({ slot, stone }) => {
      const g = window.gameTest;
      g.clearEnemies(); g.setYaw(0); g.settleCamera(); g.selectSlot(slot);
      const [px, py, pz] = g.pos;
      let pt = null, a = null;
      for (let y = Math.round(innerHeight * 0.9); y > innerHeight * 0.3 && !pt; y -= 12) for (let x = Math.round(innerWidth * 0.25); x < innerWidth * 0.75 && !pt; x += 12) {
        if (document.elementFromPoint(x, y) !== document.querySelector('body > canvas')) continue;
        const c = g.aimAt(x, y);
        if (!c || c.enemy || c.dist > 4.5 || !g.isSolid(g.blockAt(...c.dig)) || g.isSolid(g.blockAt(...c.place))) continue;
        if (stone ? g.blockAt(...c.dig) !== g.T.STONE : (g.blockAt(...c.dig) === g.T.STONE || g.blockAt(...c.dig) === g.T.GEM)) continue;
        if (Math.abs(c.dig[0] + 0.5 - px) < 1.2 && Math.abs(c.dig[2] + 0.5 - pz) < 1.2) continue;
        pt = [x, y]; a = c;
      }
      if (!pt) return { error: 'no block to dig was found' };
      const kind = g.blockAt(...a.dig), bag = g.invTotal(), dur = Object.fromEntries(g.gear.map(x => [g.tplOf(x.uid), x.dur]));
      const c = document.querySelector('body > canvas');
      const ev = t => c.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: pt[0], clientY: pt[1], pointerId: 9, button: 0 }));
      ev('pointerdown');
      const msg = g.msg, started = !!g.digging;
      let t = 0;
      while (g.isSolid(g.blockAt(...a.dig)) && t < 15) { g.stepFrames([0.05]); t += 0.05; }
      ev('pointerup');
      return { t: +t.toFixed(2), msg, started, kind, dug: !g.isSolid(g.blockAt(...a.dig)), inBag: g.invTotal() - bag, base: g.digTime(),
        durAfter: Object.fromEntries(g.gear.map(x => [g.tplOf(x.uid), x.dur])), dur, cell: a.dig, place: a.place };
    }, { slot, stone: !!stone });
    assert.deepEqual(await page.evaluate(() => { const g = window.gameTest; return [g.handSlow(g.T.DIRT), g.handSlow(g.T.GRASS), g.handSlow(g.T.SAND), g.handSlow(g.T.SNOW), g.handSlow(g.T.STONE), g.handSlow(g.T.GEM)]; }),
      [2, 2, 2, 2, 4, 6], 'by hand: soft blocks 2 times, stone 4 times, gems 6 times as long');
    // With the pickaxe (slot 1): the time it takes today
    const pick = await digOne(0);
    assert.equal(pick.error, undefined, pick.error);
    assert.ok(pick.dug && Math.abs(pick.t - pick.base) <= 0.11, 'with the pickaxe a block takes the usual time: ' + JSON.stringify(pick));
    assert.equal(pick.durAfter.pick, pick.dur.pick - 1, 'the pickaxe wears by one');
    // An empty quick bar slot (slot 3): the block is dug and is in the bag, in about 2 times the time, and the game says so once
    const hand = await digOne(2);
    assert.equal(hand.error, undefined, hand.error);
    assert.ok(hand.started && hand.dug, 'with an empty hand, holding on a block digs it');
    assert.equal(hand.inBag, 1, 'the block is in the bag');
    assert.equal(hand.msg, 'Digging by hand is slow. The pickaxe is faster.');
    assert.ok(Math.abs(hand.t - 2 * hand.base) <= 0.11, 'by hand a soft block takes about 2 times as long: ' + hand.t + ' s against ' + pick.t + ' s');
    assert.deepEqual(hand.durAfter, hand.dur, 'digging by hand wears out nothing');
    // The message comes once in a visit, not at every block
    await page.evaluate(() => window.gameTest.stepFrames(Array(90).fill(0.05)));
    const again = await digOne(2);
    assert.notEqual(again.msg, 'Digging by hand is slow. The pickaxe is faster.', 'the message is not said at every block');
    // With the sword in hand: still by hand, and the sword does not wear
    const sword = await digOne(1);
    assert.ok(sword.dug && sword.durAfter.sword === sword.dur.sword, 'digging with the sword in hand does not wear the sword');
    // Stone by hand: about 4 times as long. A stone block is put down first so that there is one to dig.
    const placed = await page.evaluate(cell => { const g = window.gameTest; g.inv.stone = 1; return g.placeCell(...cell, 'stone') !== false && g.blockAt(...cell) === g.T.STONE; }, hand.cell);
    assert.ok(placed, 'a stone block was put down for the test');
    const stone = await digOne(2, true);
    assert.equal(stone.error, undefined, stone.error);
    assert.ok(stone.dug && Math.abs(stone.t - 4 * stone.base) <= 0.11, 'by hand stone takes about 4 times as long: ' + JSON.stringify({ t: stone.t, base: stone.base }));
    console.log(`      digging times (Digging level 1): pickaxe ${pick.t} s, soft block by hand ${hand.t} s, stone by hand ${stone.t} s`);
    // After the pickaxe breaks, the child can still dig
    await page.evaluate(() => { const g = window.gameTest; const p = g.gear.find(x => g.tplOf(x.uid) === 'pick'); g.wear(p.uid, 1000); g.stepFrames(Array(70).fill(0.05)); });
    assert.equal(await page.evaluate(() => window.gameTest.gear.some(x => window.gameTest.tplOf(x.uid) === 'pick')), false, 'the pickaxe is broken');
    const broke = await digOne(0);
    assert.ok(broke.dug, 'after the pickaxe breaks the child can still dig');
    // With a block in hand, a tap still builds
    await page.evaluate(() => { const g = window.gameTest; g.addItem('dirt', 3); g.selectSlot(3); g.toQuick('dirt'); });
    const b = await tapBlock(page, {});
    assert.equal(b.error, undefined, b.error);
    assert.ok(b.after.built && !b.after.dug, 'with a block in hand a tap builds and does not dig');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { device: PC, saves: [phoneGame()] }));

test('SPEC-016 H: the powers are in the Powers panel, not at the top left; gems and the bag stay on screen', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    const hud = await page.evaluate(() => window.gameTest.hudText);
    assert.ok(/Gems \d+/.test(hud) && /Bag \d+\/\d+/.test(hud), 'the top left shows the gem count and the bag count: ' + hud);
    assert.ok(!/Lv|Digging|Building|Fighting|Inventory|Magic|World/.test(hud), 'no power levels at the top left: ' + hud);
    assert.equal(await page.evaluate(() => document.querySelectorAll('#hud .bar').length), 0, 'no bars at the top left');
    const btn = await page.evaluate(() => { const b = document.getElementById('powersBtn').getBoundingClientRect(), s = document.getElementById('settingsBtn').getBoundingClientRect(), m = document.getElementById('mapBtn').getBoundingClientRect(); return { h: b.height, w: b.width, top: b.top, right: innerWidth - b.right, beside: Math.abs(m.left - b.right) < 16 && Math.abs(s.left - m.right) < 16, star: document.getElementById('powersBtn').textContent.includes('★') }; });
    assert.ok(btn.h >= 44 && btn.w >= 44, 'the Powers button is at least 44 px: ' + JSON.stringify(btn));
    assert.ok(btn.beside && btn.star && btn.top < 60, 'the Powers button has a star and sits at the top right beside Map and Settings (the Map button came between them in 0.6.87): ' + JSON.stringify(btn));
    const panel = () => page.evaluate(() => ({ open: window.gameTest.powersOpen, shown: getComputedStyle(document.getElementById('powers')).display !== 'none', text: document.getElementById('powers').textContent,
      rows: [...document.querySelectorAll('#powers .prow')].map(r => r.textContent.trim()), bars: document.querySelectorAll('#powers .prow .bar').length }));
    await page.click('#powersBtn');
    let p = await panel();
    assert.ok(p.open && p.shown, 'a tap on the Powers button opens the panel');
    assert.deepEqual(p.rows, ['Digging Lv 1', 'Building Lv 1', 'Inventory Lv 1', 'Fighting Lv 1'], 'the panel lists the powers with their levels');
    assert.equal(p.bars, 4, 'each power has its bar');
    assert.ok(p.text.includes('Test Hero') && /World TESTWORLD/.test(p.text) && /v0\.\d+\.\d+/.test(p.text), 'the panel shows the name, the world code and the version: ' + p.text);
    // While it is open a tap on the world closes it and does nothing else
    const dirt = await page.evaluate(() => window.gameTest.invTotal());
    await page.mouse.click(400, 420);
    p = await panel();
    assert.ok(!p.open && !p.shown, 'a tap outside the panel closes it');
    assert.equal(await page.evaluate(() => ({ t: window.gameTest.invTotal(), d: !!window.gameTest.digging })).then(r => r.t + ':' + r.d), dirt + ':false', 'that tap does not dig or build');
    // Close button, Esc and the Android Back button
    await page.click('#powersBtn'); await page.click('#powersClose');
    assert.equal((await panel()).open, false, 'the Close button closes it');
    await page.click('#powersBtn'); await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => [window.gameTest.powersOpen, window.gameTest.quitOpen]), [false, false], 'Esc closes it and does not ask to quit');
    await page.click('#powersBtn'); await page.evaluate(() => window.gameTest.backAction());
    assert.equal((await panel()).open, false, 'the Back button closes it');
    // Magic is listed once learned, and a level gained is still said on screen
    const up = await page.evaluate(() => { const g = window.gameTest; g.pw.dig.xp = 1e6; g.clearEnemies(); const [px, py, pz] = g.pos; let y = Math.floor(py) - 1, x = Math.floor(px) + 2, z = Math.floor(pz); while (y > 0 && !g.isSolid(g.blockAt(x, y, z))) y--; g.digCell(x, y, z); return { msg: g.msg, lvl: g.pw.dig.lvl }; });
    assert.equal(up.msg, 'Digging power up! Level 2', 'a level gained is said on screen');
    await page.evaluate(() => { const g = window.gameTest; g.pw.fight.lvl = 2; g.chooseSkill('fireball'); });
    await page.click('#powersBtn');
    p = await panel();
    assert.deepEqual(p.rows, ['Digging Lv 2', 'Building Lv 1', 'Inventory Lv 1', 'Fighting Lv 2', 'Magic Lv 1']);
    await page.click('#powersClose');
    // Five quick taps on the top-left corner still open the parent area
    // (tapped from inside the page: five separate clicks from the test are too slow to count as quick on a slow machine)
    await page.evaluate(() => { const corner = [...document.body.children].find(d => d.style.width === '70px' && d.style.left === '0px'); for (let i = 0; i < 5; i++) corner.click(); });
    const parent = await page.evaluate(() => [...document.querySelectorAll('div')].some(d => d.textContent.trim().startsWith('Parent area') && d.getClientRects().length > 0));
    assert.ok(parent, 'five quick taps on the top-left corner open the parent area');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { device: PC, saves: [phoneGame()] }));

test('SPEC-016 H: on a phone the button at the top left still shows and hides the quick bar, and the Powers button covers no other button', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    for (const [w, h] of [[360, 780], [780, 360], [320, 568]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.evaluate(() => window.gameTest.stepFrames([0.016]));
      const over = await page.evaluate(`${BOXES_FN}(['powersBtn', 'settingsBtn', 'toggle', 'teleBtn', 'bagBtn', 'hudBtn', 'bJ', 'bH1', 'bH2', 'stick'])`);
      assert.deepEqual(over, [], `at ${w} x ${h} no button covers another: ` + over.join(', '));
    }
    await page.setViewportSize({ width: 360, height: 780 });
    const qb = () => page.evaluate(() => getComputedStyle(document.getElementById('qb')).display);
    assert.equal(await qb(), 'none', 'the quick bar starts hidden on a phone');
    await page.dispatchEvent('#hudBtn', 'click');
    assert.notEqual(await qb(), 'none', 'the button at the top left shows the quick bar');
    await page.dispatchEvent('#hudBtn', 'click');
    assert.equal(await qb(), 'none', 'and hides it again');
    await page.dispatchEvent('#powersBtn', 'click');
    assert.equal(await page.evaluate(() => window.gameTest.powersOpen), true, 'the Powers button opens the panel on a phone');
    const fits = await page.evaluate(() => { const b = document.getElementById('powers').getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight; });
    assert.ok(fits, 'the panel fits the phone screen');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { device: PHONE_TALL, saves: [phoneGame()] }));

// ---- SPEC-016, release 2 (0.6.75): quiz "Hint" and "Another question" (part D) ----
test('SPEC-016 D: a quiz question has Hint, Another question and Not now; swaps and hints have limits, give 2 gems, and show in the parents report', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!window.gameTest, null, { timeout: 60000 });
    const r = await page.evaluate(() => {
      const g = window.gameTest, out = {};
      g.stepFrames(Array(80).fill(0.05));
      g.clearEnemies();
      if (!g.friend) g.callFriend('owl');
      const panel = () => document.getElementById('quizPanel');
      const dis = c => panel().querySelector(c).disabled;
      // a maths question in pictures (counting): two hints, the second takes one wrong answer away
      g.askQuiz('count', 1); g.openQuiz();
      out.buttons = [...panel().querySelectorAll('.qrow button')].map(b => b.textContent);
      out.tall = [...panel().querySelectorAll('.qrow button')].every(b => b.getBoundingClientRect().height >= 48);
      out.fits = [...panel().querySelectorAll('button')].every(b => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; });
      out.scroll = panel().querySelector('.qbox').scrollHeight <= panel().querySelector('.qbox').clientHeight + 1;
      const lvl0 = g.quizLevels.math.best, gems0 = g.inv.gem;
      panel().querySelector('.qhintb').click();
      out.hint1 = { shown: panel().querySelector('.qhint').style.display, out: panel().querySelectorAll('.qa.out').length, grey: dis('.qhintb') };
      panel().querySelector('.qhintb').click();
      out.hint2 = { out: panel().querySelectorAll('.qa.out').length, grey: dis('.qhintb'), rightOut: panel().querySelector(`.qa[data-a="${g.quizQuestion.right}"]`).disabled };
      panel().querySelector('.qhintb').click();
      out.hint3 = g.quizHelp.hints;
      g.answerQuiz(g.quizQuestion.right);
      out.afterHint = { gems: g.inv.gem - gems0, lvl: g.quizLevels.math.best - lvl0, msg: panel().querySelector('.qmsg').textContent };
      return out;
    });
    assert.deepEqual(r.buttons, ['Hint', 'Another question', 'Not now']);
    assert.ok(r.tall, 'every small button is at least 48 px tall');
    assert.ok(r.fits && r.scroll, 'on a phone held upright all buttons are on the screen with no scrolling');
    assert.deepEqual(r.hint1, { shown: 'flex', out: 0, grey: false }, 'the first maths hint is the help that comes after two wrong tries');
    assert.deepEqual(r.hint2, { out: 1, grey: true, rightOut: false }, 'the second hint takes one wrong answer away, never the right one, and the button greys out');
    assert.equal(r.hint3, 2, 'no third hint');
    assert.deepEqual({ gems: r.afterHint.gems, lvl: r.afterHint.lvl }, { gems: 2, lvl: 0 }, 'a right answer after a hint gives 2 gems and the level stays: ' + r.afterHint.msg);
    await quizClosed(page);
    // Swaps and word hints, with a new friend
    const s = await page.evaluate(() => {
      const g = window.gameTest, out = {};
      g.removeFriend(); g.callFriend('robot');
      const panel = () => document.getElementById('quizPanel');
      g.askQuiz('add', 1); g.openQuiz();
      const k0 = g.quizQuestion.key, lv = JSON.stringify(g.quizLevels);
      panel().querySelector('.qswap').click();
      out.swap1 = { other: g.quizQuestion.key !== k0, maths: g.quizQuestion.kind !== 'word', open: g.quizOpen, grey: panel().querySelector('.qswap').disabled };
      const k1 = g.quizQuestion.key;
      panel().querySelector('.qswap').click();
      out.swap2 = { other: g.quizQuestion.key !== k1, maths: g.quizQuestion.kind !== 'word', grey: panel().querySelector('.qswap').disabled };
      const k2 = g.quizQuestion.key;
      panel().querySelector('.qswap').click();
      out.swap3 = g.quizQuestion.key === k2 && g.quizHelp.swaps === 2;
      out.levelSame = JSON.stringify(g.quizLevels) === lv;
      // a word: each hint puts one more letter in place; the button greys out at half the letters
      g.quizNotNow(); g.askQuiz('word', 35); g.openQuiz();
      const word = g.quizQuestion.word, max = g.quizHintMax(g.quizQuestion);
      out.word = { len: word.length, max, steps: [] };
      for (let i = 0; i < max + 1; i++) { panel().querySelector('.qhintb').click(); out.word.steps.push([g.quizSpell.letters, g.quizSpell.fixed, panel().querySelector('.qhintb').disabled]); }
      out.word.prefix = word.slice(0, max);
      // a word swap gives a different word
      g.quizNotNow(); g.removeFriend(); g.callFriend('turtle'); g.askQuiz('word', 5); g.openQuiz();
      const w0 = g.quizQuestion.word;
      panel().querySelector('.qswap').click();
      out.wordSwap = { other: g.quizQuestion.word !== w0, word: g.quizQuestion.kind === 'word' };
      g.quizNotNow();
      out.stats = g.quizStats;
      const div = document.createElement('div'); div.innerHTML = g.quizReportHtml(g.quizStats);
      out.head = [...div.querySelectorAll('th')].map(t => t.textContent);
      out.rows = [...div.querySelectorAll('tr')].slice(1).map(tr => [...tr.querySelectorAll('td')].map(t => t.textContent));
      return out;
    });
    assert.deepEqual(s.swap1, { other: true, maths: true, open: true, grey: false }, 'Another question on a maths question shows a different maths question');
    assert.deepEqual(s.swap2, { other: true, maths: true, grey: true }, 'after 2 swaps in one visit the button is greyed out');
    assert.ok(s.swap3, 'no third swap');
    assert.ok(s.levelSame, 'a swapped question does not move the level');
    assert.equal(s.word.max, Math.max(1, Math.floor(s.word.len / 2)));
    s.word.steps.slice(0, s.word.max).forEach(([letters, fixed, grey], i) => {
      assert.equal(letters, s.word.prefix.slice(0, i + 1), 'hint ' + (i + 1) + ' puts the next letter in its place');
      assert.equal(grey, i + 1 >= s.word.max, 'the Hint button greys out when half the letters are placed');
    });
    assert.equal(s.word.steps[s.word.max][1], s.word.max, 'no hint past half of the letters');
    assert.deepEqual(s.wordSwap, { other: true, word: true }, 'Another question on a word shows a different word');
    assert.deepEqual([s.stats.math.hints, s.stats.math.swaps, s.stats.words.hints, s.stats.words.swaps], [2, 2, s.word.max, 1], 'the report counts hints and swaps: ' + JSON.stringify(s.stats));
    assert.deepEqual(s.head.slice(-2), ['Hints used', 'Swapped']);
    assert.deepEqual(s.rows[2].slice(-2), [String(2 + s.word.max), '3'], 'the parents report shows the hints and the swaps');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { device: PHONE_TALL, saves: [phoneGame()], quiz: true }));

// ---- SPEC-016, release 3 (0.6.76): first-person view and a camera that works indoors (E), caves (F), castles (G) ----
// A saved game in a world made by land-maker 2 (caves and castles)
function gen2Game() {
  const g = JSON.parse(phoneGame());
  g.world = { v: 2, seed: 4242, gen: 2, castleGap: 500, edits: [] };
  return JSON.stringify(g);
}
const settle = page => page.evaluate(() => { const g = window.gameTest; g.clearEnemies(); g.stepFrames(Array(60).fill(0.05)); });

test('SPEC-016 E: the View button and V switch between the view from behind and through the eyes; the choice is remembered on this device', { skip, timeout: 420000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!window.gameTest, null, { timeout: 60000 });
    await settle(page);
    const st = () => page.evaluate(() => { const g = window.gameTest, [x, y, z] = g.pos, c = g.camPos(); return { view: g.viewMode, body: g.avatarShown, hand: g.handViewShown, eyeGap: Math.hypot(c[0] - x, c[1] - (y + 1.5), c[2] - z), stored: localStorage.getItem('kidsgame.view') }; });
    let s = await st();
    assert.equal(s.view, 'back', 'a new player starts in the view from behind');
    assert.ok(s.body && !s.hand, 'from behind the body shows and the hand view does not');
    const btn = await page.evaluate(() => { const b = document.getElementById('viewBtn').getBoundingClientRect(), t = document.getElementById('settingsBtn').getBoundingClientRect(); return { h: b.height, top: b.top, near: Math.abs(b.right - t.left) < 70 || Math.abs(t.right - b.left) < 70 }; });
    assert.ok(btn.h >= 44 && btn.top < 60 && btn.near, 'the View button is at the top right beside Settings: ' + JSON.stringify(btn));
    // the view changes at once, inside the click: well under half a second, with no frame needed
    const took = await page.evaluate(() => { const t = performance.now(); document.getElementById('viewBtn').click(); return window.gameTest.viewMode === 'eyes' ? performance.now() - t : 1e9; });
    s = await st();
    assert.ok(took < 500, 'the view changes at once: ' + took + ' ms');
    assert.equal(s.view, 'eyes');
    assert.ok(!s.body && s.hand, 'through the eyes the body is hidden and the item in hand shows');
    assert.ok(s.eyeGap < 0.01, 'the camera is at the eyes');
    assert.equal(s.stored, 'eyes', 'the choice is kept on this device');
    // not in the saved game
    assert.ok(!/eyes/.test(await page.evaluate(() => { window.gameTest.saveGame(); return Object.keys(localStorage).filter(k => k.startsWith('kidsgame.slot.')).map(k => localStorage.getItem(k)).join(''); })), 'the view is not in the saved game');
    await page.keyboard.press('KeyV');
    assert.equal((await st()).view, 'back', 'V switches back');
    await page.keyboard.press('KeyV');
    // after closing and opening the game, the view is the one used last
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.gameTest, null, { timeout: 180000 });
    s = await st();
    assert.equal(s.view, 'eyes', 'the view used last comes back');
    assert.ok(!s.body && s.hand);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { device: PC, saves: [phoneGame()] }));

test('SPEC-016 E: dragging up and down looks up and down and stops at 80 degrees; through the eyes the child digs, builds and hits within reach', { skip, timeout: 480000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!window.gameTest, null, { timeout: 60000 });
    await settle(page);
    const drag = (dy) => page.evaluate(dy => {
      const c = document.querySelector('body > canvas'), x = innerWidth / 2, y = innerHeight / 2;
      const ev = (t, yy) => c.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: x, clientY: yy, pointerId: 11, button: 0 }));
      ev('pointerdown', y); for (let i = 1; i <= 10; i++) ev('pointermove', y + dy * i / 10); ev('pointerup', y + dy);
      return window.gameTest.pitch;
    }, dy);
    for (const view of ['back', 'eyes']) {
      await page.evaluate(v => window.gameTest.setView(v), view);
      const p0 = await page.evaluate(() => window.gameTest.pitch);
      const up = await drag(-60);
      assert.ok(up > p0, view + ': dragging up looks up');
      const down = await drag(120);
      assert.ok(down < up, view + ': dragging down looks down');
      const top = await drag(-5000), bottom = await drag(5000);
      const max = await page.evaluate(() => window.gameTest.PITCH_MAX);
      assert.ok(Math.abs(top - max) < 1e-9 && Math.abs(bottom + max) < 1e-9, view + ': it stops at 80 degrees each way');
      assert.ok(Math.abs(max - 80 * Math.PI / 180) < 1e-9);
    }
    // Through the eyes: dig a block in front, place a block, hit a monster close by
    const r = await page.evaluate(() => {
      const g = window.gameTest, out = {};
      g.setView('eyes'); g.setYaw(0); g.setPitch(-0.6); g.settleCamera(); g.clearEnemies();
      const c = document.querySelector('body > canvas');
      const tap = (x, y, hold) => { c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 12, button: 0 })); if (hold) g.stepFrames(Array(hold).fill(0.05)); c.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 12, button: 0 })); };
      // find a block under the middle of the screen
      let pt = null; for (let y = innerHeight * 0.5; y < innerHeight * 0.9 && !pt; y += 8) { const a = g.aimAt(innerWidth / 2, y); if (a && !a.enemy && a.dist <= g.reach && g.isSolid(g.blockAt(...a.dig))) pt = [innerWidth / 2, y, a]; }
      if (!pt) return { error: 'no block in view' };
      g.selectSlot(0);
      const bag = g.invTotal();
      tap(pt[0], pt[1], 40);
      out.dug = !g.isSolid(g.blockAt(...pt[2].dig)) && g.invTotal() > bag;
      g.addItem('dirt', 2); g.selectSlot(3); g.toQuick('dirt');
      const a2 = g.aimAt(pt[0], pt[1]);
      tap(pt[0], pt[1]);
      out.built = !!a2 && g.isSolid(g.blockAt(...a2.place));
      if (out.built) g.digCell(...a2.place);   // out of the way again
      return out;
    });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));   // the changed blocks are drawn again
    const r2 = await page.evaluate(() => {
      const g = window.gameTest, out = {};
      const c = document.querySelector('body > canvas');
      const tap = (x, y) => { for (const t of ['pointerdown', 'pointerup']) c.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 12, button: 0 })); };
      g.selectSlot(1); g.setPitch(-0.2); g.settleCamera();
      if (!g.enemyNear('goblin', 0, -2)) return { ...out, error: 'no goblin' };
      const en = g.enemies[g.enemies.length - 1], [sx, sy] = g.screenOf(en), hp = en.hp;
      let hit = false; for (const oy of [0, -10, 10, -20, 20, -30, -40, 30]) { if (hit) break; const a = g.aimAt(sx, sy + oy); if (a && a.enemy === en) { tap(sx, sy + oy); hit = en.hp < hp; } }
      out.hit = hit;
      return out;
    });
    assert.equal(r.error, undefined, r.error);
    assert.ok(r.dug, 'through the eyes a block is dug');
    assert.ok(r.built, 'through the eyes a block is placed');
    assert.equal(r2.error, undefined, r2.error);
    assert.ok(r2.hit, 'through the eyes a monster within 2 blocks is hit');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { device: PC, saves: [phoneGame()] }));

test('SPEC-016 E: from behind, in a tunnel 2 blocks high, the camera comes in close and never sits inside a block', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!window.gameTest, null, { timeout: 60000 });
    await settle(page);
    const r = await page.evaluate(() => {
      const g = window.gameTest, [px, py, pz] = g.pos.map(Math.floor), out = {};
      g.setView('back'); g.setYaw(0); g.settleCamera();
      out.open = +g.camDist().toFixed(2);
      // a tunnel 2 high and 30 long, deep in stone, running along the camera's line
      const y0 = py - 12;
      for (let x = px - 4; x <= px + 4; x++) for (let z = pz - 16; z <= pz + 16; z++) for (let y = y0 - 1; y <= y0 + 6; y++) g.placeCell(x, y, z, 'stone');
      for (let z = pz - 15; z <= pz + 15; z++) for (const y of [y0, y0 + 1]) { const id = g.blockAt(px, y, z); g.digCell(px, y, z); }
      g.setPos(px + 0.5, y0 + 0.01, pz + 0.5); g.setYaw(0); g.settleCamera();
      const c = g.camPos();
      out.tunnel = +g.camDist().toFixed(2);
      out.clear = g.camClear(...c);
      out.inBlock = g.isSolid(g.blockAt(Math.floor(c[0]), Math.floor(c[1]), Math.floor(c[2])));
      for (const p of [-0.9, 0.5, 1.2]) { g.setPitch(p); g.settleCamera(); const q = g.camPos(); if (g.isSolid(g.blockAt(Math.floor(q[0]), Math.floor(q[1]), Math.floor(q[2])))) out.inBlock = true; }
      return out;
    });
    assert.ok(r.tunnel < r.open, 'the camera comes in closer in the tunnel: ' + JSON.stringify(r));
    assert.ok(r.clear && !r.inBlock, 'the camera is never inside a block: ' + JSON.stringify(r));
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { device: PC, saves: [phoneGame()] }));

test('SPEC-016 E: with ?perf=1 the frame rate shows on the screen', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!window.gameTest, null, { timeout: 60000 });
    await page.goto(page.url().split('?')[0] + '?perf=1', { waitUntil: 'domcontentloaded' });
    const shown = await page.waitForFunction(() => { const b = document.getElementById('perfBox'); return b && getComputedStyle(b).display !== 'none' && /fps/.test(b.textContent); }, null, { timeout: 60000 }).then(() => true, () => false);
    assert.ok(shown, 'the frame rate shows on the screen');
    assert.deepEqual(errors.filter(e => !/perf/.test(e)), [], 'errors: ' + errors.join(' | '));
  }, { device: PC, saves: [phoneGame()] }));

test('SPEC-016 F and G: a new world has caves and castles; light dims in a cave room; castle blocks go into the bag; far castles show as outlines', { skip, timeout: 300000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!window.gameTest, null, { timeout: 60000 });
    await settle(page);
    const r = await page.evaluate(() => {
      const g = window.gameTest, out = { gen: g.gen, gap: g.castleGap };
      let m = null; for (let gx = -3; gx <= 2 && !m; gx++) for (let gz = -3; gz <= 2 && !m; gz++) { const k = g.mouthInCell(gx, gz); if (k && !k.hole) m = k; }
      out.mouth = !!m;
      // at the far side of a big room with no roof hole, away from the way in: dim; at the cave mouth: bright
      const R = m.room, l = Math.hypot(R.x - m.x, R.z - m.z), fx = R.x + (R.x - m.x) / l * (R.r - 2.5), fz = R.z + (R.z - m.z) / l * (R.r - 2.5);
      let fy = R.y; while (g.isSolid(g.blockAt(Math.floor(fx), fy, Math.floor(fz)))) fy++;
      g.setPos(Math.floor(fx) + 0.5, fy + 0.01, Math.floor(fz) + 0.5);
      out.room = g.caveLightTarget();
      const [sx, , sz] = [m.x, 0, m.z];
      let y = 90; while (y > 0 && !g.isSolid(g.blockAt(sx, y, sz))) y--;
      g.setPos(sx + 0.5, y + 1.01, sz + 0.5);
      out.mouthLight = g.caveLightTarget();
      // the tower house near the start: dig its castle stone, see its outline from far away
      const st = g.towerNearStart();
      out.dist = Math.round(Math.hypot(st.sx + 12 - 200000, st.sz + 12 - 200000));
      let x = st.sx, z = st.sz, yy = st.floorY + 2; while (g.blockAt(x, yy, z) !== g.T.CSTONE && yy < st.floorY + 10) yy++;
      const before = g.inv.castle_stone || 0;
      g.setPos(x - 1.5, st.floorY + 0.01, z + 0.5);
      g.digCell(x, yy, z);
      out.dug = (g.inv.castle_stone || 0) - before;
      g.setPos(st.sx + 12 + 400, 80, st.sz + 12); g.updateOutlines(); out.far = g.outlineCount();
      g.setPos(st.sx + 12 + 30, 80, st.sz + 12); g.updateOutlines(); out.near = g.outlineCount();
      g.setPos(st.sx + 12 + 900, 80, st.sz + 12); g.updateOutlines(); out.tooFar = g.outlineCount();
      return out;
    });
    assert.equal(r.gen, 2); assert.equal(r.gap, 500);
    assert.ok(r.mouth, 'a cave mouth near the start');
    assert.equal(r.room, 1, 'inside a big room the light dims');
    assert.equal(r.mouthLight, 0, 'at the cave mouth it is bright');
    assert.ok(r.dist >= 100 && r.dist <= 200, 'the tower house is 100 to 200 blocks from the start');
    assert.equal(r.dug, 1, 'a dug castle stone goes into the bag');
    assert.ok(r.far >= 1, 'from 400 blocks away the castle shows as an outline');
    assert.ok(r.tooFar < r.far || r.tooFar === 0 || r.far > 0, 'outlines come and go with distance');
    // the light really fades in play: a few frames in the room
    await page.evaluate(() => { const g = window.gameTest; let m = null; for (let gx = -3; gx <= 2 && !m; gx++) for (let gz = -3; gz <= 2 && !m; gz++) { const k = g.mouthInCell(gx, gz); if (k && !k.hole) m = k; } const R = m.room, l = Math.hypot(R.x - m.x, R.z - m.z), fx = R.x + (R.x - m.x) / l * (R.r - 2.5), fz = R.z + (R.z - m.z) / l * (R.r - 2.5); let fy = R.y; while (g.isSolid(g.blockAt(Math.floor(fx), fy, Math.floor(fz)))) fy++; g.setPos(Math.floor(fx) + 0.5, fy + 0.01, Math.floor(fz) + 0.5); });
    const dimmed = await page.waitForFunction(() => window.gameTest.caveDim > 0.3, null, { timeout: 90000 }).then(() => true, () => false);
    assert.ok(dimmed, 'the light fades in the room');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { device: PC, saves: [gen2Game()] }));

// ---- Castle life and travelling merchants (0.6.77) ----
test('a merchant trades: monster parts and blocks for gems, gems for gear; not enough gems or a full bag is refused; Back closes it', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    const r = await page.evaluate(() => {
      const g = window.gameTest, out = {};
      const sword = g.BUYS.find(b => b.gear === 'iron_sword'), stone = g.BUYS.find(b => b.get && b.get[0] === 'castle_stone');
      g.setInv('gem', 20); g.setInv('goblin_ear', 3); g.setInv('dirt', 8);
      out.open = g.openTradeWith([{ parts: true }, g.SELLS[0], sword, stone]);
      const panel = document.getElementById('tradePanel');
      out.rows = panel.querySelectorAll('.trow').length;
      out.typing = panel.querySelectorAll('input,textarea,select,[contenteditable],a').length;
      out.sellParts = g.doTrade(0); out.afterParts = [g.inv.gem, g.inv.goblin_ear];
      out.sellDirt = g.doTrade(1); out.afterDirt = [g.inv.gem, g.inv.dirt];
      out.buySword = g.doTrade(2); out.afterSword = [g.inv.gem, g.gearList.includes('iron_sword')];
      out.again = g.doTrade(2); out.msg = document.querySelector('#tradePanel .qmsg').textContent;
      g.setInv('gem', 5); g.setInv('stone', 200);
      out.full = g.doTrade(3); out.fullMsg = document.querySelector('#tradePanel .qmsg').textContent;
      g.setInv('stone', 0);
      g.backAction();
      out.closed = !g.tradeOpen && !document.getElementById('tradePanel') && !g.paused;
      out.offers = [1, 2, 3].map(n => g.merchantOffers(n).length);
      out.gearOffer = [1, 2, 3, 4, 5].every(n => g.merchantOffers(n).some(o => o.gear));
      return out;
    });
    assert.equal(r.open, true);
    assert.equal(r.rows, 4);
    assert.equal(r.typing, 0, 'no typing and no links in the trade panel');
    assert.equal(r.sellParts, true); assert.deepEqual(r.afterParts, [23, 0]);
    assert.equal(r.sellDirt, true); assert.deepEqual(r.afterDirt, [24, 0]);
    assert.equal(r.buySword, true); assert.deepEqual(r.afterSword, [9, true]);
    assert.equal(r.again, false); assert.match(r.msg, /gems/);
    assert.equal(r.full, false); assert.match(r.fullMsg, /bag is full/i);
    assert.equal(r.closed, true);
    assert.deepEqual(r.offers, [7, 7, 7]);   // six, and since 0.6.81 one of the new castle blocks
    assert.equal(r.gearOffer, true, 'every merchant sells at least one piece of gear');
    assert.deepEqual(errors, []);
  }, { saves: [readyGame()] }));

// ---- 0.6.78: "Play again" after a right answer, quiz badges, merchants that ride on ----
test('after a right answer the question stays open: Play again asks a new question with the usual gems, Done (or Esc) lets the friend leave; badges come at the milestones', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    const a = await friendArrives(page, 'owl', 'add');
    assert.equal(a.error, undefined, a.error);
    assert.equal((await pressFriend(page)).open, true);
    const r = await page.evaluate(() => {
      const g = window.gameTest, out = {}, panel = () => document.getElementById('quizPanel');
      out.setBad = g.setQuizBadges([5, 3, 9, 10, 11]);   // not in order: refused
      out.set = g.setQuizBadges([1, 2, 3, 4, 5]);
      const total0 = g.quizRightTotal(), gems0 = g.inv.gem, key0 = g.quizQuestion.key;
      g.answerQuiz(g.quizQuestion.right);
      out.gems1 = g.inv.gem - gems0;
      out.badge1 = (panel().querySelector('.qbadge') || {}).textContent || '';
      // no timer: the panel is still open well after the old 1.3 seconds
      return new Promise(res => setTimeout(() => {
        out.stillOpen = g.quizOpen;
        out.endButtons = [...panel().querySelectorAll('.qend button')].map(b => b.textContent);
        out.answersOff = [...panel().querySelectorAll('.qa')].every(b => b.disabled);
        out.tall = [...panel().querySelectorAll('.qend button')].every(b => b.getBoundingClientRect().height >= 48);
        panel().querySelector('.qagain').click();
        // the new question is maths (three answer buttons) or a word (one tile per letter): half and half
        const q2 = g.quizQuestion, word = q2.kind === 'word';
        out.again = { open: g.quizOpen, newKey: q2.key !== key0, buttons: panel().querySelectorAll(word ? '.qt' : '.qa').length === (word ? q2.letters.length : 3), notNow: !!panel().querySelector('.qnot'), paused: g.paused };
        const gems1 = g.inv.gem;
        if (word) { const used = []; for (const ch of q2.word) { const i = q2.letters.findIndex((c, k) => c === ch && !used.includes(k)); used.push(i); g.quizTile(i); } }
        else g.answerQuiz(q2.right);
        out.gems2 = g.inv.gem - gems1;
        out.badge2 = (panel().querySelector('.qbadge') || {}).textContent || '';
        out.total = g.quizRightTotal() - total0;
        out.earned = g.quizBadgesEarned();
        g.backAction();   // Esc / Back after a right answer means Done
        out.closed = !g.quizOpen && !g.paused;
        out.state = g.friend && g.friend.state;
        out.quitOpen = g.quitOpen;
        res(out);
      }, 2500));
    });
    assert.equal(r.setBad, false, 'milestones out of order are refused');
    assert.equal(r.set, true);
    assert.equal(r.gems1, 5);
    assert.match(r.badge1, /New badge: 1 right answer!/);
    assert.equal(r.stillOpen, true, 'the question closed by itself');
    assert.deepEqual(r.endButtons, ['Play again', 'Done']);
    assert.equal(r.answersOff, true, 'the answer buttons are off after a right answer');
    assert.equal(r.tall, true);
    assert.deepEqual(r.again, { open: true, newKey: true, buttons: true, notNow: true, paused: true });
    assert.equal(r.gems2, 5, 'Play again pays the usual gems');
    assert.match(r.badge2, /New badge: 2 right answers!/);
    assert.equal(r.total, 2);
    assert.equal(r.earned, 2);
    assert.equal(r.closed, true);
    assert.equal(r.state, 'leave', 'the friend leaves after Done');
    assert.equal(r.quitOpen, false, 'Back also asked about quitting');
    // The Powers panel shows the badges
    // The Powers panel shows the badges near the top, big enough to see (0.6.79: the parent could not find the 0.6.78 line)
    const pb = await page.evaluate(() => {
      document.getElementById('powersBtn').click();
      const box = document.getElementById('quizBadgeRow'), panel = document.getElementById('powers');
      if (!box) return null;
      const r = box.getBoundingClientRect(), p = panel.getBoundingClientRect();
      return { text: box.textContent, lit: box.querySelectorAll('.pb:not(.off)').length, dark: box.querySelectorAll('.pb.off').length,
        star: box.querySelector('.pb svg').getBoundingClientRect().height, inView: r.top >= p.top && r.bottom <= p.bottom, afterName: box.previousElementSibling.className === 'pname' };
    });
    assert.ok(pb, 'no badge section in Powers');
    assert.match(pb.text, /Quiz badges: 2 of 5/);
    assert.match(pb.text, /Next badge at 3/);
    assert.equal(pb.lit, 2); assert.equal(pb.dark, 3);
    assert.ok(pb.star >= 40, 'badge stars too small');
    assert.equal(pb.inView, true, 'badges need scrolling to be seen');
    assert.equal(pb.afterName, true);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()], quiz: true }));

test('a merchant stopped by the child rides on after 20 seconds without a trade, and stops again only after the child has walked away', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    const r = await page.evaluate(() => {
      const g = window.gameTest, m = { s: 50, dir: 1, wait: 0, stopped: false }, L = 400, out = {};
      const run = (secs, dist) => { for (let t = 0; t < secs; t += 0.1) g.merchantStep(m, L, dist, true, 0.1); };
      run(1, 3);
      out.stops = m.stopped; out.s1 = m.s;
      run(g.MERCH_PATIENCE - 2, 3);
      out.stillStopped = m.stopped && m.s === out.s1;
      run(3, 3);
      out.ridesOn = !m.stopped && m.s > out.s1;
      const s2 = m.s;
      run(5, 5);   // the child follows it: it keeps going
      out.keepsGoing = !m.stopped && m.s > s2;
      run(1, g.MERCH_GO + 1);   // the child walks away
      run(0.5, 3);              // and comes back
      out.stopsAgain = m.stopped;
      // a cart the child does not come near never stops, and turns round at the end of its road after waiting
      const n = { s: 395, dir: 1, wait: 0, stopped: false };
      for (let t = 0; t < 3; t += 0.1) g.merchantStep(n, L, 200, true, 0.1);
      out.turned = n.dir === -1 && n.s === L;
      for (let t = 0; t < 17; t += 0.1) g.merchantStep(n, L, 200, true, 0.1);
      out.back = n.s < L;
      return out;
    });
    assert.deepEqual(r, { stops: true, s1: r.s1, stillStopped: true, ridesOn: true, keepsGoing: true, stopsAgain: true, turned: true, back: true });
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()] }));

test('SPEC-019: the website game shows no update screen or button; past the limit a pretend Google Play page is shown after a save, and closing it blocks play', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    // the game is open; the update check does not need the character to have landed
    await page.waitForFunction(() => window.gameTest && window.gameTest.upd, null, { timeout: 90000 });
    const r = await page.evaluate(async () => {
      const g = window.gameTest, out = {};
      const shown = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
      out.webButton = shown('updRestart'); out.webScreen = shown('updNeeded'); out.webLine = g.upd.line;
      const calls = [];
      g.upd.days = 30;
      g.setUpdPlugin({
        getAppUpdateInfo: async () => ({ updateAvailability: 2, clientVersionStalenessDays: 45, immediateUpdateAllowed: true, flexibleUpdateAllowed: true }),
        performImmediateUpdate: async () => { calls.push('immediate'); return { code: 1 }; },
        startFlexibleUpdate: async () => { calls.push('flexible'); return { code: 0 }; },
        completeFlexibleUpdate: async () => {}, addListener: async () => ({ remove() {} }),
      });
      await g.updCheck();
      g.updTick();
      await new Promise(r => setTimeout(r, 300));
      out.calls = calls.slice(); out.blocked = shown('updNeeded');
      out.text = document.getElementById('updText').textContent;
      out.line = g.upd.line;
      return out;
    });
    assert.deepEqual(r, { webButton: false, webScreen: false, webLine: '', calls: ['immediate'], blocked: true,
      text: 'A new version is needed to keep playing.', line: 'New version ready' });
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()] }));

// ---- 0.6.81: castles with much more detail (SPEC-020), roads (SPEC-023), guards (SPEC-021), dragons (SPEC-022),
// shared worlds (SPEC-024) ----
test('0.6.81: new castles, roads and dragons appear near the start with no errors; the tower house has the new look', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameProbe().drawn > 0, null, { timeout: 60000 });
    const r = await page.evaluate(() => {
      const G = window.gameTest, net = G.roadNet(), s = G.roadSample(0);
      return { roads: net.length, main: net.some(e => e.main), lane: net.some(e => !e.main), sample: s, block: G.blockAt(Math.floor(s.x), s.h, Math.floor(s.z)), T: G.T };
    });
    assert.ok(r.roads > 3, 'roads join the castles: ' + r.roads);
    assert.ok([r.T.COBBLE, r.T.EARTH, r.T.WOOD].includes(r.block), 'a road block in the middle of a road: ' + r.block);
    await page.waitForFunction(() => window.gameTest.dragons().length > 0, null, { timeout: 150000 });
    const d = await page.evaluate(() => window.gameTest.dragonsNear());
    assert.ok(d.length >= 1 && d.length <= 3, 'one to three dragons: ' + d.length);
    for (const x of d) assert.ok(x.state === 'fly' && x.y > 20, 'flying high: ' + JSON.stringify(x));
    assert.deepEqual(errors.filter(e => !/GL Driver/.test(e)), [], errors.join('\n'));
  }, { saves: [phoneGame()], choice: '0' }));

test('SPEC-022: the parent\'s Dragons control: Off shows none, Stay high keeps them up, On lets one eat a tree that becomes a stump', { skip, timeout: 400000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameTest.dragons().length > 0, null, { timeout: 150000 });
    await page.evaluate(() => window.gameTest.setDragonMode('off'));
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.gameTest.dragons().length), 0, 'Off: no dragon is drawn');
    await page.evaluate(() => window.gameTest.setDragonMode('high'));
    await page.waitForTimeout(500);
    // Stay high: even a dragon told to come down stays in the sky
    const high = await page.evaluate(() => { const G = window.gameTest, d = G.dragonsNear()[0]; G.startEat({ id: d.id, tx: 200010, ty: 20, tz: 200010, lx: 200013, ly: 21, lz: 200010, t0: G.sharedNow / 1000 }); return G.dragonsNear().every(x => x.state === 'fly'); });
    assert.ok(high, 'Stay high: dragons never come down');
    await page.evaluate(() => window.gameTest.setDragonMode('on'));
    // On: find a tree near the child and let a dragon eat it
    const tree = await page.evaluate(() => { const G = window.gameTest; for (let i = 0; i < 20; i++) { const t = G.pickTree(); if (t) return t; } return null; });
    if (tree) {
      await page.evaluate(t => { const G = window.gameTest, d = G.dragonsNear()[0]; G.startEat({ id: d.id, ...t, t0: G.sharedNow / 1000 - 7.5 }); }, tree);
      // (the test browser draws slowly: the whole visit of the dragon may be over by the time the page is asked again)
      await page.waitForFunction(t => window.gameTest.eatenList().some(e => e[0] === t.tx && e[1] === t.tz), tree, { timeout: 60000 });
      assert.equal(await page.evaluate(t => window.gameTest.treeLook(t.tx, t.tz), tree), 1, 'a stump on the day it was eaten');
      const list = await page.evaluate(() => window.gameTest.eatenList());
      assert.ok(list.some(e => e[0] === tree.tx && e[1] === tree.tz && e[3] > e[2] && e[3] - e[2] <= 2), 'the eaten tree is in the world list with its regrow day: ' + JSON.stringify(list));
      const msg = await page.evaluate(() => window.gameTest.msg);
      assert.ok(/dragon is eating a tree/.test(msg) || msg === '', 'the first-time line: ' + msg);
    }
    assert.deepEqual(errors.filter(e => !/GL Driver/.test(e)), [], errors.join('\n'));
  }, { saves: [phoneGame()], choice: '0' }));

test('SPEC-021: guards by the worth of the goods, the owner\'s steps, the escort mix, and walking pace with foot guards', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const G = window.gameTest, out = {};
      out.counts = [0, 29, 30, 39, 40, 50, 57, 58, 200].map(w => G.guardCount(w));
      G.setGuardSteps({ guard_max: 6, guard_step1: 10, guard_step2: 20, guard_step3: 30, guard_step4: 40 });
      out.six = { max: G.guardMax, steps: G.guardSteps, n: G.guardCount(60) };
      G.setGuardSteps({ guard_max: 4, guard_step1: 30, guard_step2: 30, guard_step3: 50, guard_step4: 58 });   // a step not bigger than the one before: refused
      out.bad = G.guardSteps.slice(0, 4);
      G.setGuardSteps({});
      out.plans = Array.from({ length: 200 }, (_, n) => G.escortPlan(n * 7919, 1 + n % 4).map(g => g.kind));
      return out;
    });
    assert.deepEqual(r.counts, [0, 0, 1, 1, 2, 3, 3, 4, 4]);
    assert.equal(r.six.max, 6); assert.deepEqual(r.six.steps, [10, 20, 30, 40, 48, 56]); assert.equal(r.six.n, 6);
    assert.deepEqual(r.bad, [30, 40, 50, 58], 'bad steps fall back to the starting values');
    const all = r.plans.flat();
    for (const k of ['foot', 'horse', 'sled', 'lookout', 'captain']) assert.ok(all.includes(k), 'escorts include ' + k);
    assert.ok(r.plans.filter(p => p.length >= 4).every(p => p.includes('captain')), 'a captain on carts with 4 or more');
    assert.ok(r.plans.every(p => !p.includes('captain') || p.length >= 4), 'no captain on smaller escorts');
    const withFoot = r.plans.filter(p => p.includes('foot')).length / r.plans.length;
    assert.ok(withFoot > 0.35 && withFoot < 0.8, 'about half of escorts have a foot guard: ' + withFoot);
    // carts on the roads: one with a foot guard goes at walking pace, one with riders only at the usual pace
    await page.waitForFunction(() => window.gameTest.merchants().length > 0, null, { timeout: 60000 });
    const ms = await page.evaluate(() => window.gameTest.merchants());
    for (const m of ms) assert.equal(m.speed, m.guards.includes('foot') ? 2.5 : 5, JSON.stringify(m));
    assert.deepEqual(errors.filter(e => !/GL Driver/.test(e)), [], errors.join('\n'));
  }, { saves: [phoneGame()], choice: '0' }));

test('0.6.85: a monster the guards defeat sinks away after a few seconds; one the child defeats stays', { skip, timeout: 400000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameTest.enemies.length > 1, null, { timeout: 150000 });
    const start = await page.evaluate(() => {
      const G = window.gameTest, [a, b] = G.enemies, p = window.gameProbe();
      for (const en of [a, b]) { en.x = p.px + 1.5; en.z = p.pz; en.y = p.py; }
      const n = G.corpseList.length;
      G.defeatEnemy(a, { guard: true });
      G.defeatEnemy(b);
      return { list: G.corpseList.slice(n) };
    });
    assert.equal(start.list.length, 2, 'both lie down first');
    assert.ok(start.list[0].guard && !start.list[1].guard, JSON.stringify(start.list));
    // 3 seconds lying, 3 seconds sinking, and some room: played in the game's own time, which a slow test machine does not keep up with
    const after = await page.evaluate(() => { window.gameTest.stepFrames(Array(160).fill(0.05)); return window.gameTest.corpseList; });
    assert.equal(after.filter(c => c.guard).length, 0, 'the guards\' monster is gone');
    assert.ok(after.some(c => !c.guard), 'the child\'s monster still lies there (5 minutes)');
    assert.deepEqual(errors.filter(e => !/GL Driver/.test(e)), [], errors.join('\n'));
  }, { saves: [phoneGame()], choice: '0' }));

test('SPEC-021: what a monster defeated by guards drops is collected by a guard; the child cannot pick it up', { skip, timeout: 400000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameTest.enemies.length > 0, null, { timeout: 150000 });
    const before = await page.evaluate(() => {
      const G = window.gameTest, en = G.enemies[0], gems = G.inv ? G.inv.gem : null;
      const p = window.gameProbe(); en.x = p.px + 0.5; en.z = p.pz; en.y = p.py;   // right next to the child
      G.defeatEnemy(en, { guard: true });
      return { gems, drops: G.dropList.filter(d => d.guard).length };
    });
    await page.waitForTimeout(1000);
    const mid = await page.evaluate(() => window.gameTest.dropList.filter(d => d.guard).length);
    await page.waitForTimeout(2000);
    const after = await page.evaluate(() => ({ guard: window.gameTest.dropList.filter(d => d.guard).length }));
    assert.equal(after.guard, 0, 'gone after about 2 seconds');
    assert.ok(mid <= before.drops, 'never picked up by the child');
    assert.deepEqual(errors.filter(e => !/GL Driver/.test(e)), [], errors.join('\n'));
  }, { saves: [phoneGame()], choice: '0' }));

test('SPEC-020 and SPEC-023: the owner\'s merchant prices and cart limit; merchants sell the new castle blocks', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    const r = await page.evaluate(() => {
      const G = window.gameTest, out = {};
      out.start = G.PRICE_START['mp_castle_stone'];
      G.applyOwnerSettings({ mp_castle_stone: 512, mp_window: 99999, carts_max: 2 });
      const offers = G.merchantOffers(12345);
      out.sells = offers.some(o => o.get && G.CASTLE_BLOCK_BUYS().includes(o.get[0]));
      const cs = Array.from({ length: 40 }, (_, n) => G.merchantOffers(n * 31)).flat().find(o => o.get && o.get[0] === 'castle_stone');
      out.cs = cs ? [cs.give[0][1], cs.get[1]] : null;
      const w = Array.from({ length: 40 }, (_, n) => G.merchantOffers(n * 31)).flat().find(o => o.get && o.get[0] === 'window');
      out.window = w ? [w.give[0][1], w.get[1]] : null;
      out.carts = G.cartsMax;
      G.applyOwnerSettings({ carts_max: 50 });
      out.cartsBad = G.cartsMax;
      G.applyOwnerSettings({ carts_max: 2 });
      return out;
    });
    assert.equal(r.start, 310, 'castle stone starts at 10 for 3 gems');
    assert.ok(r.sells, 'a merchant sells one of the new castle blocks');
    if (r.cs) assert.deepEqual(r.cs, [5, 12], 'the owner\'s price is used');
    if (r.window) assert.deepEqual(r.window, [3, 6], 'a price out of range is refused: the starting price stays');
    assert.equal(r.carts, 2); assert.equal(r.cartsBad, 6, 'carts_max outside 1 to 20: the starting 6');
    await page.waitForTimeout(6000);
    const shown = await page.evaluate(() => window.gameTest.merchants().filter(m => m.shown).length);
    assert.ok(shown <= 2, 'no more than 2 carts on screen: ' + shown);
    assert.deepEqual(errors.filter(e => !/GL Driver/.test(e)), [], errors.join('\n'));
  }, { saves: [phoneGame()], choice: '0' }));

test('SPEC-024: a monster defeated together: equal shares, the odd gem to the last hitter, a far helper\'s share on the ground', { skip, timeout: 120000 }, () =>
  withGame(async (page) => {
    const s = await page.evaluate(() => window.gameTest.splitShares(5, ['a', 'b'], 'b', [{ key: 'a', x: 0, z: 0 }, { key: 'b', x: 30, z: 0 }], 2, 0));
    assert.deepEqual(s, [['a', 2, 1, 1], ['b', 3, 1, 0]]);
    const alone = await page.evaluate(() => ({ shared: window.gameTest.sharedOn(), leads: window.gameTest.isLeader() }));
    assert.deepEqual(alone, { shared: false, leads: true }, 'alone, the game plays as before');
  }, { saves: [phoneGame()], choice: '0' }));

test('0.6.87: the player count at the top left, the world\'s log bubble, and the map with M', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameTest && /Players 1/.test(document.getElementById('hud').textContent), null, { timeout: 60000 });
    // the log (0.6.87): the bubble lights up with a count, a tap opens the list, the notes stay to read again
    await page.evaluate(() => { window.gameTest.addNote('Sir Kestrel 4 joined your world'); window.gameTest.addNote('Dame Elowen 2 joined your world'); });
    let st = await page.evaluate(() => ({ on: document.getElementById('chatBtn').classList.contains('on'), lit: document.getElementById('chatBtn').classList.contains('new'), n: document.getElementById('chatCount').textContent }));
    assert.deepEqual(st, { on: true, lit: true, n: '2' });
    await page.evaluate(() => document.getElementById('chatBtn').click());
    st = await page.evaluate(() => ({ open: document.getElementById('chatLog').classList.contains('open'), text: document.getElementById('chatLines').textContent, lit: document.getElementById('chatBtn').classList.contains('new'), unread: window.gameTest.logUnread }));
    assert.equal(st.open, true); assert.equal(st.lit, false); assert.equal(st.unread, 0);
    assert.match(st.text, /Sir Kestrel 4 joined your world.*Dame Elowen 2 joined your world/);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.getElementById('chatLog').classList.contains('open')), false, 'Esc closes the log');
    await page.evaluate(() => document.getElementById('chatBtn').click());
    assert.match(await page.evaluate(() => document.getElementById('chatLines').textContent), /Sir Kestrel 4/, 'the notes are still there to read again');
    await page.evaluate(() => window.gameTest.toggleLog(false));
    // 0.6.89: a hint goes into the log (no red count); the same hint again adds to its line
    st = await page.evaluate(() => { const G = window.gameTest, n = G.worldLog.length; G.say('Too far away! Get closer.'); G.say('Too far away! Get closer.');
      const l = G.worldLog; return { added: l.length - n, last: l[l.length - 1], unread: G.logUnread, top: !!document.getElementById('msg'), peek: document.getElementById('chatPeek').textContent }; });
    assert.equal(st.added, 1); assert.equal(st.last.text, 'Too far away! Get closer.'); assert.equal(st.last.n, 2); assert.equal(st.last.hint, true);
    assert.equal(st.unread, 0); assert.equal(st.top, false); assert.equal(st.peek, 'Too far away! Get closer.');
    await page.keyboard.press('KeyM');
    assert.equal(await page.evaluate(() => window.gameTest.mapOpen), true, 'M opens the map');
    const lit = await page.evaluate(() => { const d = document.getElementById('mapLand').getContext('2d').getImageData(40, 40, 16, 16).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 150) n++; return n; });
    assert.ok(lit > 0, 'the map shows the land around the child');
    await page.keyboard.press('KeyM');
    assert.equal(await page.evaluate(() => window.gameTest.mapOpen), false, 'M closes it again');
    await page.evaluate(() => document.getElementById('mapBtn').click());
    assert.equal(await page.evaluate(() => window.gameTest.mapOpen), true, 'the Map button opens it');
    await page.evaluate(() => document.getElementById('mapBox').click());
    assert.equal(await page.evaluate(() => window.gameTest.mapOpen), false, 'a tap on the map closes it');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [fightLevel2Game()] }));

// ---- Share the game (0.6.88, SPEC-030) ----
test('share the game: the button is in the parent area; a tap opens the share window with the fixed text and address and adds 500 gems once; a second tap adds nothing; with the reward off no gems', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors, requests) => {
    await page.evaluate(() => {
      window.__shared = [];
      navigator.share = d => { window.__shared.push(d); return Promise.resolve(); };
    });
    const gems = () => page.evaluate(() => window.gameTest.inv.gem || 0);
    const before = await gems();
    assert.equal(await page.evaluate(() => !!document.getElementById('shareBtn') && getComputedStyle(document.getElementById('parentArea')).display), 'none', 'the button sits in the closed parent area');
    const sent = requests.length;
    await page.evaluate(() => document.getElementById('shareBtn').click());
    await page.waitForFunction(() => window.__shared.length === 1);
    const d = await page.evaluate(() => window.__shared[0]);
    assert.equal(d.url, 'https://free-game-vitale.vercel.app/');
    assert.equal(d.text, 'Adventurers of Drenerics: a block-building adventure for children and families. Play free in your browser:');
    assert.equal(await gems(), before + 500);
    assert.equal(requests.slice(sent).filter(u => !u.startsWith('http://127.0.0.1')).length, 0, 'nothing is sent when the share window opens');
    assert.match(await page.evaluate(() => document.getElementById('shareLine').textContent), /The 500 gems have been added to this game/);
    assert.equal(await page.evaluate(() => window.gameTest.share.given), true);
    await page.evaluate(() => document.getElementById('shareBtn').click());
    await page.waitForFunction(() => window.__shared.length === 2);
    assert.equal(await gems(), before + 500, 'a second tap adds nothing');
    // kept in the saved game
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('kidsgame.slot.0')).shared), true);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }));

test('share the game with the reward off (or 300 gems): the button still shares, no line about gems, no gems', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await page.evaluate(() => { window.__shared = []; navigator.share = d => { window.__shared.push(d); return Promise.resolve(); }; });
    const gems = () => page.evaluate(() => window.gameTest.inv.gem || 0);
    const before = await gems();
    await page.evaluate(() => { window.gameTest.setShareReward(false, 500); document.getElementById('shareBtn').click(); });
    await page.waitForFunction(() => window.__shared.length === 1);
    assert.equal(await gems(), before);
    assert.doesNotMatch(await page.evaluate(() => document.getElementById('shareLine').textContent), /gems/);
    await page.evaluate(() => { window.gameTest.setShareReward(true, 300); document.getElementById('shareBtn').click(); });
    await page.waitForFunction(() => window.__shared.length === 2);
    assert.equal(await gems(), before + 300);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }));

// ---- Playing together, safely (0.6.90, SPEC-039) ----
test('SPEC-039: the Playing together card shows once before a shared game reopens; OK after 4 seconds; Esc does not skip it', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameTest && window.gameTest.together.cardOpen, null, { timeout: 60000 });
    // slow test machines may reach this after the 4 seconds: the OK button is checked against the time the card opened
    const early = await page.evaluate(() => ({ vis: getComputedStyle(document.getElementById('togetherOk')).visibility, age: Date.now() - +document.getElementById('togetherCard').dataset.at }));
    if (early.age < 3800) assert.equal(early.vis, 'hidden', 'no OK before 4 seconds');
    assert.match(await page.evaluate(() => document.getElementById('togetherCard').textContent), /Only play with friends and family you know\..*tell a grown-up\./);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.gameTest.together.cardOpen), true, 'Esc does not skip it');
    assert.equal(await page.evaluate(() => window.gameTest.quitOpen), false, 'Esc does not open Quit behind it');
    await page.waitForFunction(() => getComputedStyle(document.getElementById('togetherOk')).visibility === 'visible', null, { timeout: 8000 });
    assert.ok(await page.evaluate(() => Date.now() - +document.getElementById('togetherCard').dataset.at) >= 3900, 'OK shows after 4 seconds');
    await page.evaluate(() => document.getElementById('togetherOk').click());
    const st = await page.evaluate(() => ({ open: window.gameTest.together.cardOpen, card: !!document.getElementById('togetherCard'), seen: localStorage.getItem('kidsgame.togetherCard') }));
    assert.deepEqual(st, { open: false, card: false, seen: '1' });
    // not shown again on this device
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.gameTest && window.gameTest.together, null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => !!document.getElementById('togetherCard')), false, 'shown once per device');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [phoneGame()], togetherCard: true }));

test('SPEC-039: the loading screen shows a safety line, a different one each time the game opens', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    const lines = await page.evaluate(() => window.SAFETY_LINES);
    assert.equal(lines.length, 5);
    const first = await page.evaluate(() => localStorage.getItem('kidsgame.safetyLine'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    const tip = await page.evaluate(() => (document.getElementById('spTip') || {}).textContent);
    const second = await page.evaluate(() => localStorage.getItem('kidsgame.safetyLine'));
    assert.notEqual(second, first, 'the next line in turn');
    assert.equal(tip, lines[+second]);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }));

test('SPEC-039: Playing together needs a Google sign-in; Off leaves the shared world, keeps playing alone and blocks joining', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameTest && window.gameTest.together.worldId === 'TESTWORLD', null, { timeout: 60000 });
    const open = async () => { for (let i = 0; i < 5; i++) await page.mouse.click(12, 12); };
    await open();
    let st = await page.evaluate(() => ({ btn: document.getElementById('parentLink').textContent, fb: getComputedStyle(document.getElementById('cloudFacebook')).display,
      off: document.querySelector('[data-together="off"]').disabled, note: document.getElementById('togetherNote').textContent }));
    assert.equal(st.btn, 'Open parent portal');
    assert.equal(st.fb, 'none', 'no Facebook button');
    assert.equal(st.off, true, 'greyed out without Google');
    assert.match(st.note, /Connect your Google account to change this/);
    // Facebook alone does not unlock it
    await page.evaluate(() => window.gameTest.togetherSignIn({ id: 'u1', email: 'p@example.com', app_metadata: { provider: 'facebook', providers: ['facebook'] }, identities: [{ provider: 'facebook' }] }));
    assert.equal(await page.evaluate(() => document.querySelector('[data-together="off"]').disabled), true, 'Facebook does not unlock it');
    // Google unlocks it
    await page.evaluate(() => window.gameTest.togetherSignIn({ id: 'u1', email: 'p@example.com', app_metadata: { provider: 'google', providers: ['google'] }, identities: [{ provider: 'google' }] }));
    await page.evaluate(() => document.querySelector('[data-together="off"]').click());
    st = await page.evaluate(() => ({ t: window.gameTest.together, msg: window.gameTest.worldLog.map(l => l.text), save: JSON.parse(localStorage.getItem('kidsgame.slot.0')), dev: localStorage.getItem('kidsgame.together') }));
    assert.equal(st.t.on, false); assert.equal(st.t.by, 'google'); assert.equal(st.t.worldId, null); assert.equal(st.t.local, true);
    assert.ok(st.msg.includes('A grown-up turned off playing together.'));
    assert.equal(st.save.together, 'off'); assert.equal(st.save.togetherBy, 'google'); assert.equal(st.save.worldId, null); assert.equal(st.save.local, true);
    assert.equal(st.dev, 'off', 'remembered on this device for a new game');
    assert.match(await page.evaluate(() => document.getElementById('togetherNote').textContent), /Changed by a grown-up signed in with Google/);
    // the game keeps playing on its own
    assert.equal(await page.evaluate(() => window.gameTest.together.worldId), null);
    // a world code set again (as from a cloud save) is left within 5 seconds
    await page.evaluate(() => window.gameTest.setWorldIdForTest('TESTWORLD'));
    await page.waitForFunction(() => window.gameTest.together.worldId === null, null, { timeout: 5000 });
    // reopening: plays on its own world, no wizard
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.gameTest && window.gameTest.together, null, { timeout: 60000 });
    st = await page.evaluate(() => ({ t: window.gameTest.together, wiz: document.getElementById('wiz').classList.contains('hide') }));
    assert.equal(st.t.on, false); assert.equal(st.t.local, true); assert.equal(st.wiz, true, 'the wizard does not open');
    // the wizard of a new game offers no joining
    await page.evaluate(() => { sessionStorage.setItem('kidsgame.choice', 'new'); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.gameTest && !document.getElementById('wiz').classList.contains('hide'), null, { timeout: 60000 });
    await page.evaluate(() => { for (let i = 0; i < 3; i++) { const b = document.querySelector('#wizBody [data-sex], #wizBody [data-race]'); if (b) b.click(); document.getElementById('wizNext').click(); } });
    st = await page.evaluate(() => ({ off: document.getElementById('wizTogetherOff') && document.getElementById('wizTogetherOff').textContent, join: document.getElementById('wizJoinOff') && document.getElementById('wizJoinOff').disabled }));
    assert.equal(st.off, 'A grown-up turned off playing together.'); assert.equal(st.join, true);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [phoneGame()] }));

test('SPEC-039: a shared game opened with no internet plays on its own and says so', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameTest && window.gameTest.together.resumeWait === 'TESTWORLD', null, { timeout: 60000 });
    assert.ok(await page.evaluate(() => window.gameTest.worldLog.some(l => l.text === "Can't reach your shared world. Playing on your own until it's back.")));
    assert.equal(await page.evaluate(() => window.gameTest.together.worldId), 'TESTWORLD', 'the world code is kept, to try again');
  }, { saves: [phoneGame()], noSupabase: true }));

// ---- Report anything that looks wrong (0.6.91, SPEC-038) ----
const REPORT_FIELDS = ['p_kind', 'p_category', 'p_reporter', 'p_ai_line', 'p_world', 'p_x', 'p_y', 'p_z', 'p_look', 'p_changed', 'p_player'];
test('SPEC-038: in a shared world Settings has Report; a build is reported in 3 taps with no typing and only the allowed fields; the parent area lists it', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameTest && window.gameTest.together.worldId === 'TESTWORLD', null, { timeout: 60000 });
    await page.evaluate(() => document.getElementById('settingsBtn').click());
    assert.match(await page.evaluate(() => document.getElementById('settingsReport').textContent), /Report something wrong/);
    await page.evaluate(() => document.getElementById('settingsReport').click());
    assert.equal(await page.evaluate(() => window.gameTest.reportOpen), true);
    assert.equal(await page.evaluate(() => document.querySelectorAll('#reportPanel input,#reportPanel textarea,#reportPanel select,#reportPanel a').length), 0, 'no typing');
    const small = await page.evaluate(() => [...document.querySelectorAll('#reportPanel button')].filter(b => b.getBoundingClientRect().height < 48).length);
    assert.equal(small, 0, 'buttons at least 48 px');
    await page.evaluate(() => document.querySelector('[data-rkind="build"]').click());   // tap 1
    await page.evaluate(() => document.querySelector('[data-rcat="rude"]').click());     // tap 2
    assert.match(await page.evaluate(() => document.getElementById('reportThanks').textContent), /Thank you! A grown-up will look at it\. If something upset you, tell a grown-up you trust\./);
    const a = await page.evaluate(() => window.gameTest.lastReportArgs);
    assert.deepEqual(Object.keys(a).filter(k => !REPORT_FIELDS.includes(k)), []);
    assert.equal(a.p_kind, 'build'); assert.equal(a.p_category, 'rude'); assert.equal(a.p_world, 'TESTWORLD');
    assert.ok(Number.isInteger(a.p_x) && Number.isInteger(a.p_z) && Number.isInteger(a.p_changed) && a.p_look >= 0 && a.p_look < 360);
    assert.doesNotMatch(JSON.stringify(a), /Test Hero/, 'no name in a report');
    await page.evaluate(() => document.querySelector('[data-rdone]').click());          // tap 3: OK
    assert.equal(await page.evaluate(() => window.gameTest.reportOpen), false);
    // the parent area lists it, on this device
    const list = await page.evaluate(() => window.gameTest.reportList());
    assert.equal(list.length, 1); assert.equal(list[0].kind, 'build');
    await page.evaluate(() => { const t = [...document.body.children].find(d => d.style.width === '70px' && d.style.top === '0px'); for (let i = 0; i < 5; i++) t.click(); });
    assert.match(await page.evaluate(() => document.getElementById('reportsSent').textContent), /Reports sent from this game.*Rude or mean, something someone built/);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [phoneGame()] }));

test('SPEC-038: a player is reported and hidden (no character, no name, not in the log); a 6th report in 10 minutes is not sent', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameTest && window.gameTest.together.worldId === 'TESTWORLD', null, { timeout: 60000 });
    await page.evaluate(() => window.gameTest.addOtherForTest('abcdef123456', { name: 'Sir Kestrel 4', x: 200002, y: 30, z: 200002, yaw: 0 }));
    await page.evaluate(() => window.gameTest.openReport(true));
    await page.evaluate(() => document.querySelector('[data-rkind="player"]').click());
    assert.match(await page.evaluate(() => document.getElementById('reportPanel').textContent), /Sir Kestrel 4/);
    await page.evaluate(() => document.querySelector('[data-rplayer="abcdef123456"]').click());
    await page.evaluate(() => document.querySelector('[data-rcat="scary"]').click());
    const a = await page.evaluate(() => window.gameTest.lastReportArgs);
    assert.equal(a.p_kind, 'player'); assert.equal(a.p_player, 'abcdef123456'); assert.equal(a.p_x, undefined);
    assert.match(await page.evaluate(() => document.getElementById('reportPanel').textContent), /Hide this player\?/);
    await page.evaluate(() => document.querySelector('[data-rhide="1"]').click());
    const st = await page.evaluate(() => ({ hidden: window.gameTest.hidden, others: window.gameTest.othersList }));
    assert.deepEqual(st.hidden, ['abcdef123456']);
    assert.equal(st.others[0].visible, false, 'the character is not drawn');
    await page.evaluate(() => document.querySelector('[data-rdone]').click());
    // 4 more reports: 5 in all; the 6th is not sent
    for (let i = 0; i < 4; i++) await page.evaluate(() => { window.gameTest.openReport(true); document.querySelector('[data-rkind="other"]').click(); document.querySelector('[data-rcat="wrong"]').click(); document.querySelector('[data-rdone]').click(); });
    assert.equal(await page.evaluate(() => window.gameTest.reportList().length), 5);
    await page.evaluate(() => window.gameTest.openReport(true));
    assert.match(await page.evaluate(() => document.getElementById('reportPanel').textContent), /Thanks, we have your reports/);
    assert.equal(await page.evaluate(() => window.gameTest.reportList().length), 5, 'nothing sent');
    await page.evaluate(() => window.gameTest.openReport(false));
    await page.evaluate(() => document.getElementById('settingsBtn').click());
    assert.match(await page.evaluate(() => document.getElementById('settingsReport').textContent), /Thanks, we have your reports/);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [phoneGame()] }));

test('SPEC-038: an AI line flag reports and hides it; put the land back; stopping multiplayer leaves the world within 5 seconds', { skip, timeout: 120000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameTest && window.gameTest.together.worldId === 'TESTWORLD', null, { timeout: 60000 });
    // AI line flag (ready for SPEC-037)
    await page.evaluate(() => { const d = document.createElement('div'); d.id = 'aiTest'; d.innerHTML = window.gameTest.aiFlagHtml('fact42'); document.body.append(d); document.querySelector('[data-aiflag="fact42"]').click(); });
    assert.match(await page.evaluate(() => document.getElementById('aiTest').textContent), /Thank you! A grown-up will check it\./);
    assert.equal(await page.evaluate(() => window.gameTest.aiLineHidden('fact42')), true);
    assert.equal(await page.evaluate(() => window.gameTest.lastReportArgs.p_ai_line), 'fact42');
    // put the land back: a block changed near the player is put back as the seed made it
    const land = await page.evaluate(() => { const g = window.gameTest, [x, y, z] = g.pos.map(Math.floor); g.setWriteBlock(x + 3, y + 6, z + 3, 3);
      const before = g.landBox(x, z, false); g.landBox(x, z, true); return { before, after: g.landBox(x, z, false) }; });
    assert.ok(land.before >= 1); assert.equal(land.after, 0);
    // stop multiplayer for this visit
    await page.evaluate(() => window.gameTest.setMpStopForTest(Date.now() + 86400000));
    await page.waitForFunction(() => window.gameTest.together.worldId === null, null, { timeout: 5000 });
    assert.ok(await page.evaluate(() => window.gameTest.worldLog.some(l => l.text === 'Playing together is turned off for now.')));
    assert.equal(await page.evaluate(() => window.gameTest.together.on), true, 'the parent switch is not changed');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [phoneGame()] }));

// ---- Delete my data (0.6.70, SPEC-010). The sign-in and the server are stood in for: no email is sent in these tests. ----
const dmdState = page => page.evaluate(() => window.gameTest.dmd.state);
const dmdSaves = page => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('kidsgame.slot.')).length);
const dmdTap = (page, act) => page.evaluate(a => document.querySelector(`#dmd [data-dmd="${a}"]`).click(), act);
async function dmdOpenFromSettings(page) {
  await page.dispatchEvent('#settingsBtn', 'click');
  await page.dispatchEvent('#settingsDelete', 'click');
  await page.waitForFunction(() => !!document.getElementById('dmdBox'), null, { timeout: 15000 });
}
async function dmdHold(page, ms) {
  await page.dispatchEvent('#dmdHold', 'pointerdown');
  // A full hold: keep holding until the screen moves on (a slow test machine may run its 3-second timer late)
  if (ms >= 3000) return page.waitForFunction(() => window.gameTest.dmd.state && window.gameTest.dmd.state.step !== 'sure', null, { timeout: 30000 });
  await page.waitForTimeout(ms);
  await page.evaluate(() => { const el = document.getElementById('dmdHold'); if (el) el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); });
}
async function dmdType(page, id, text) {
  await page.evaluate(([id, text]) => { const el = document.getElementById(id); el.value = text; el.dispatchEvent(new Event('input', { bubbles: true })); }, [id, text]);
}
// Stands in for a signed-in parent and for the server; window.dmdCalls lists what the game asked the server
const dmdSignedIn = (page, answers) => page.evaluate(answers => {
  window.dmdCalls = [];
  window.gameTest.dmd.setSession(async () => ({ id: 'u1', email: 'parent@example.test' }));
  window.gameTest.dmd.setServer(async (action, code) => { window.dmdCalls.push(action + (code ? ':' + code : '')); return action === 'request' ? { ok: true, minutes: 15 } : answers.shift(); });
}, answers);
async function dmdToCode(page) {
  await dmdOpenFromSettings(page);
  await dmdTap(page, 'want');
  await dmdHold(page, 3200);
  await dmdType(page, 'dmdWord', 'DELETE');
  await dmdTap(page, 'word');
  await page.waitForFunction(() => window.gameTest.dmd.state && window.gameTest.dmd.state.step === 'code', null, { timeout: 15000 });
}

test('Settings has "Delete my data" above Quit; it lists what will be deleted, and Cancel at any of the three steps deletes nothing', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    await page.dispatchEvent('#settingsBtn', 'click');
    const order = await page.evaluate(() => { const d = document.getElementById('settingsDelete'), q = document.getElementById('settingsQuit');
      return { label: d && d.textContent, above: !!d && !!q && !!(d.compareDocumentPosition(q) & Node.DOCUMENT_POSITION_FOLLOWING), h: d ? d.getBoundingClientRect().height : 0 }; });
    assert.equal(order.label, 'Delete my data');
    assert.ok(order.above, 'Delete my data must sit above Quit the game');
    assert.ok(order.h >= 44, 'the button is too small to tap');
    await page.dispatchEvent('#settingsDelete', 'click');
    await page.waitForFunction(() => !!document.getElementById('dmdBox'), null, { timeout: 15000 });
    assert.deepEqual(await page.evaluate(() => ({ settings: window.gameTest.settingsOpen, blocks: window.gameTest.dmd.blocksGame })), { settings: false, blocks: true }, 'Settings closes, and the game behind takes no taps or keys');
    const list = await page.evaluate(() => document.getElementById('dmdBox').textContent);
    for (const words of ['for grown-ups', 'saved games on this device (2)', 'quiz friends reports', 'settings', 'Gameplay records and error reports', 'Shared worlds', 'Cancel']) assert.ok(list.includes(words), 'the list does not say: ' + words);
    assert.ok(!list.includes('cloud save') && !list.includes('email'), 'with no parent signed in, the cloud save and email must not be mentioned');
    // Cancel on screen 1
    await dmdTap(page, 'cancel');
    assert.equal(await dmdState(page), null);
    // Cancel on screen 2; a short hold does nothing
    await dmdOpenFromSettings(page);
    await dmdTap(page, 'want');
    assert.ok((await page.evaluate(() => document.getElementById('dmdBox').textContent)).includes('cannot be undone'));
    await dmdHold(page, 1200);
    assert.equal((await dmdState(page)).step, 'sure', 'a hold shorter than 3 seconds must not go on');
    await dmdTap(page, 'cancel');
    // Cancel on screen 3; a wrong word keeps Continue switched off; Esc closes too
    await dmdOpenFromSettings(page);
    await dmdTap(page, 'want');
    await dmdHold(page, 3200);
    assert.equal((await dmdState(page)).step, 'word');
    for (const word of ['delete', 'DELET', 'YES']) {
      await dmdType(page, 'dmdWord', word);
      assert.equal(await page.evaluate(() => document.getElementById('dmdWordGo').disabled), true, 'Continue must stay off for: ' + word);
      await dmdTap(page, 'word');
      assert.equal((await dmdState(page)).step, 'word');
    }
    await page.evaluate(() => window.gameTest.backAction());
    assert.equal(await dmdState(page), null, 'Esc or Back closes the screen');
    assert.equal(await dmdSaves(page), 2, 'cancelling must keep every saved game');
    assert.equal(await page.evaluate(() => window.gameTest.dmd.wiping), false);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame(), savedGame()] }));

test('Delete my data with no parent signed in: after the three confirmations the saved games and settings on the device are gone, and no email is asked for or sent', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    await page.evaluate(() => { window.dmdCalls = []; window.gameTest.dmd.setServer(async a => { window.dmdCalls.push(a); return { ok: true }; }); localStorage.setItem('kidsgame.audio', '{"sfx":2,"music":1}'); });
    await dmdOpenFromSettings(page);
    await dmdTap(page, 'want');
    await dmdHold(page, 3200);
    assert.equal(await page.evaluate(() => document.querySelectorAll('#dmd input').length), 1, 'only the DELETE word is typed: no email box');
    await dmdType(page, 'dmdWord', 'DELETE');
    assert.equal(await dmdSaves(page), 2, 'nothing may be deleted before the third confirmation');
    await dmdTap(page, 'word');
    assert.equal((await dmdState(page)).step, 'done');
    assert.ok((await page.evaluate(() => document.getElementById('dmdBox').textContent)).includes('Your data has been deleted'));
    assert.deepEqual(await page.evaluate(() => ({ keys: Object.keys(localStorage), session: Object.keys(sessionStorage), calls: window.dmdCalls })), { keys: [], session: [], calls: [] });
    // The game must not save itself back before it restarts
    await page.evaluate(() => window.gameTest.saveGame());
    assert.equal(await dmdSaves(page), 0);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame(), savedGame()] }));

test('Delete my data with a parent signed in: a code is asked for after the three confirmations, and a wrong code, five wrong codes or a code older than 15 minutes delete nothing', { skip, timeout: 300000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    await dmdSignedIn(page, [{ error: 'wrong', left: 4 }, { error: 'cancelled' }]);
    await dmdOpenFromSettings(page);
    const list = await page.evaluate(() => document.getElementById('dmdList').textContent);
    assert.ok(list.includes('cloud save') && list.includes('parent account'), 'a signed-in parent is told about the cloud save and the account');
    await dmdTap(page, 'cancel');
    await dmdToCode(page);
    assert.deepEqual(await page.evaluate(() => window.dmdCalls), ['request'], 'the code is asked for once, only after the three confirmations');
    const text = await page.evaluate(() => document.getElementById('dmdBox').textContent);
    assert.ok(text.includes('6-digit code') && text.includes('15 minutes') && !text.includes('parent@example.test'), 'the screen must explain the code and not show the address');
    assert.equal(await dmdSaves(page), 1, 'nothing is deleted until the code is typed');
    // Not 6 digits: the server is not asked
    await dmdType(page, 'dmdCode', '12ab');
    await dmdTap(page, 'code');
    assert.deepEqual(await page.evaluate(() => window.dmdCalls), ['request']);
    // A wrong code, then the fifth wrong code
    await dmdType(page, 'dmdCode', '000000');
    await dmdTap(page, 'code');
    await page.waitForFunction(() => /Tries left: 4/.test(window.gameTest.dmd.state.msg), null, { timeout: 15000 });
    await dmdType(page, 'dmdCode', '000001');
    await dmdTap(page, 'code');
    await page.waitForFunction(() => window.gameTest.dmd.state.step === 'stopped', null, { timeout: 15000 });
    assert.ok((await dmdState(page)).msg.includes('Nothing was deleted'));
    await dmdTap(page, 'cancel');
    // A code older than 15 minutes is refused by the game itself
    await dmdToCode(page);
    await page.evaluate(() => window.gameTest.dmd.ageCode(window.gameTest.dmd.CODE_MS + 1000));
    await dmdType(page, 'dmdCode', '123456');
    await dmdTap(page, 'code');
    assert.equal((await dmdState(page)).step, 'stopped');
    assert.equal((await page.evaluate(() => window.dmdCalls)).filter(c => c === 'confirm:123456').length, 0, 'an old code must not be sent');
    await dmdTap(page, 'cancel');
    assert.equal(await dmdSaves(page), 1, 'every saved game must still be there');
    assert.equal(await page.evaluate(() => window.gameTest.dmd.wiping), false);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()] }));

test('Delete my data with a parent signed in: after the right code the device has no saved games and the parent is signed out', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await playing(page);
    await dmdSignedIn(page, [{ ok: true, deleted: true }]);
    await page.evaluate(() => localStorage.setItem('sb-test-auth-token', 'kept sign-in'));
    await dmdToCode(page);
    await dmdType(page, 'dmdCode', '123456');
    await dmdTap(page, 'code');
    await page.waitForFunction(() => window.gameTest.dmd.state.step === 'done', null, { timeout: 15000 });
    assert.deepEqual(await page.evaluate(() => window.dmdCalls), ['request', 'confirm:123456']);
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), [], 'the saved games, the settings and the kept sign-in must all be gone');
    await page.evaluate(() => window.gameTest.backAction());
    assert.equal((await dmdState(page)).step, 'done', 'the last screen stays until OK');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [readyGame()] }));

// ---- Mirelo, the wandering mage (0.6.93, SPEC-028) ----
test('SPEC-028: at Fighting level 2 Mirelo comes instead of "Magic unlocked!"; Show me, his fireball, the ring, the child\'s fireball on the target, then Fireball is learned; no new request', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameTest && window.gameTest.mirelo, null, { timeout: 60000 });
    await page.evaluate(() => { const g = window.gameTest, [x, y, z] = g.pos.map(Math.floor); for (let dx = -14; dx <= 14; dx++) for (let dz = -14; dz <= 14; dz++) { g.setWriteBlock(x + dx, y - 1, z + dz, 3); for (let u = 0; u < 4; u++) g.setWriteBlock(x + dx, y + u, z + dz, 0); } });   // open, flat ground
    const requests = [];
    await page.evaluate(() => { const g = window.gameTest; g.mirelo.clearSkills(); g.mirelo.load(null); g.mirelo.setFightLevel(2); g.mirelo.setWait(0); });
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => window.gameProbe().skillPanel), false, 'no "Magic unlocked!" panel');
    await page.waitForFunction(() => window.gameTest.mirelo.state.here || (window.gameTest.mirelo.call(), false), null, { timeout: 20000, polling: 500 });
    page.on('request', r => requests.push(r.url()));
    await page.evaluate(() => { window.gameTest.mirelo.arrive(); window.gameTest.mirelo.open(); });
    assert.equal(await page.evaluate(() => window.gameTest.tipText), 'Hello, young adventurer! I am Mirelo. I sense magic in you. Watch!');
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#tipPanel button')].map(b => b.textContent)), ['Show me', 'Not now']);
    await page.evaluate(() => document.querySelector('#tipPanel .mshow').click());
    await page.waitForFunction(() => { const l = window.gameTest.mirelo.state.lesson; return l && l.stage === 'try'; }, null, { timeout: 20000 });
    const st = await page.evaluate(() => ({ ring: document.getElementById('bSpell').classList.contains('ring'), skills: window.gameProbe().skills, l: window.gameTest.mirelo.state.lesson, pos: window.gameTest.pos }));
    assert.equal(st.ring, true, 'the Spell button shows a ring');
    assert.deepEqual(st.skills, [], 'not learned yet');
    assert.ok(Math.hypot(st.l.x - st.pos[0], st.l.z - st.pos[2]) <= 17, 'the target is near the child');
    // the target is not a block: the world there is still air
    assert.equal(await page.evaluate(() => { const l = window.gameTest.mirelo.state.lesson; return window.gameTest.blockAt(Math.floor(l.x), Math.floor(l.y), Math.floor(l.z)); }), 0);
    // the child casts at the target
    await page.evaluate(() => { const g = window.gameTest, l = g.mirelo.state.lesson, p = g.pos; g.castAt(l.x - p[0], l.y - (p[1] + 1.2), l.z - p[2]); });
    await page.waitForFunction(() => window.gameProbe().skillPanel, null, { timeout: 15000 });
    assert.match(await page.evaluate(() => document.getElementById('skillPanel').textContent), /Fireball is yours!/);
    await page.evaluate(() => document.querySelector('#skillPanel [data-skill="fireball"]').click());
    const end = await page.evaluate(() => ({ skills: window.gameProbe().skills, m: window.gameTest.mirelo.state, ring: document.getElementById('bSpell').classList.contains('ring') }));
    assert.deepEqual(end.skills, ['fireball']); assert.equal(end.m.lesson, null); assert.equal(end.m.met, true); assert.equal(end.ring, false);
    assert.deepEqual(requests.filter(u => /supabase|rest\/v1|functions\/v1|rpc\//.test(u)), [], 'no new request while he talks and teaches');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [phoneGame()] }));

test('SPEC-028: two "Not now" (or the owner\'s minutes) unlock the fireball as before; a tip visit shows a tip, follows the child, and "Come back later" keeps him away for the owner\'s hours; the switch stops his tips', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameTest && window.gameTest.mirelo, null, { timeout: 60000 });
    await page.evaluate(() => { const g = window.gameTest, [x, y, z] = g.pos.map(Math.floor); for (let dx = -14; dx <= 14; dx++) for (let dz = -14; dz <= 14; dz++) { g.setWriteBlock(x + dx, y - 1, z + dz, 3); for (let u = 0; u < 4; u++) g.setWriteBlock(x + dx, y + u, z + dz, 0); } });   // open, flat ground
    await page.evaluate(() => { const g = window.gameTest; g.mirelo.clearSkills(); g.mirelo.load({ lesson: 'todo', nots: 2 }); g.mirelo.setFightLevel(2); });
    await page.waitForFunction(() => window.gameProbe().skillPanel, null, { timeout: 15000 });
    assert.match(await page.evaluate(() => document.getElementById('skillPanel').textContent), /Magic unlocked!/);
    await page.evaluate(() => document.querySelector('#skillPanel [data-skill="fireball"]').click());
    assert.equal(await page.evaluate(() => window.gameTest.mirelo.state.lesson), null);
    // a tip visit
    await page.waitForFunction(() => window.gameTest.mirelo.state.here || (window.gameTest.mirelo.call(), false), null, { timeout: 20000, polling: 500 });
    await page.evaluate(() => { window.gameTest.mirelo.arrive(); window.gameTest.mirelo.open(); });
    assert.equal(await page.evaluate(() => window.gameTest.tipText), 'I see you found your magic! Fire fizzles in water, so keep your fireballs dry!');
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#tipPanel button')].map(b => b.textContent)), ['Thanks!', 'Come back later']);
    await page.evaluate(() => document.querySelector('#tipPanel .mthanks').click());
    let m = await page.evaluate(() => window.gameTest.mirelo.state);
    assert.equal(m.tips, 1); assert.equal(m.met, true); assert.equal(m.here, true, 'he stays and walks along');
    // he follows: the child moves 12 blocks away over open ground, he walks after them (never jumping there)
    await page.evaluate(() => { const g = window.gameTest; g.clearEnemies(); g.mirelo.arrive(); });
    const moved = await page.evaluate(() => { const g = window.gameTest; let n = 0; for (let i = 0; i < 20; i++) if (g.mirelo.follow(0.05)) n++; return n; });
    assert.ok(moved === 0, 'close to the child he stands still');
    const walk = await page.evaluate(() => { const g = window.gameTest, p = g.pos; g.clearEnemies(); g.mirelo.farTest(9); let n = 0; for (let i = 0; i < 10; i++) if (g.mirelo.follow(0.1)) n++; const f1 = g.mirelo.state.friend; return { n, step: Math.hypot(f1.x - (p[0] + 9), f1.z - p[2]) }; });
    assert.ok(walk.n === 10 && walk.step > 2 && walk.step < 7.5, 'left behind, he walks after the child and does not jump there: ' + JSON.stringify(walk));
    // Come back later
    await page.evaluate(() => { const g = window.gameTest; g.mirelo.load({ lesson: 'skipped', tips: 1, last: 0, met: true }); });
    await page.evaluate(() => { const g = window.gameTest; g.mirelo.gone(); g.mirelo.call(); g.mirelo.arrive(); g.mirelo.open(); });
    assert.equal(await page.evaluate(() => window.gameTest.tipText), 'Some monsters are weak to fire. Fire hurts them twice as much!');
    await page.evaluate(() => document.querySelector('#tipPanel .mlater').click());
    m = await page.evaluate(() => window.gameTest.mirelo.state);
    const hours = (m.away - Date.now()) / 3600000;
    assert.ok(hours > 23.9 && hours <= 24, 'away for 24 hours: ' + hours);
    assert.equal(await page.evaluate(() => { window.gameTest.mirelo.setWait(0); return window.gameTest.mirelo.due(1); }), false, 'not due while away');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('kidsgame.slot.0')).mirelo.away > Date.now()), true, 'kept in the saved game');
    // the switch
    await page.evaluate(() => { const g = window.gameTest; g.mirelo.setAway(0); g.mirelo.setOn(false); g.mirelo.setWait(0); });
    assert.equal(await page.evaluate(() => window.gameTest.mirelo.due(1)), false, 'Tips from Mirelo off: he does not come');
    assert.equal(await page.evaluate(() => localStorage.getItem('kidsgame.mirelo')), '0');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [phoneGame()] }));

// ---- Dragons that fly like real dragons (0.6.94, SPEC-033) ----
test('SPEC-033: every kind flies head first (within 10 degrees), leans at most 35 and tips at most 25 degrees, flaps to climb and glides; kinds and rare colours follow the weights; no two dragons alike', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameTest && window.gameTest.dragonOf, null, { timeout: 60000 });
    const r = await page.evaluate(() => {
      const G = window.gameTest, deg = a => a * 180 / Math.PI, diff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
      const out = { worst: 0, lean: 0, tip: 0, kinds: {}, n: 0, rare: 0, flaps: 0, glides: 0, looks: new Set(), family: 0, perKind: {}, flat: 0 };
      for (let gx = -30; gx < 30; gx++) for (let gz = -30; gz < 30; gz++) {
        const d = G.dragonOf(gx, gz);
        if (!d) continue;
        out.n++; out.kinds[d.babies ? 'family' : d.kind] = (out.kinds[d.babies ? 'family' : d.kind] || 0) + 1; if (d.rare) out.rare++;
        if (Math.abs(gx) <= 3 && Math.abs(gz) <= 3) { out.near = (out.near || 0) + 1; (out.nl = out.nl || new Set()).add([d.kind, d.babies, d.col, d.size.toFixed(3), d.neck.toFixed(3), d.tail.toFixed(3), d.wing.toFixed(3), d.r.toFixed(1), d.flap.toFixed(3)].join('|')); }
        out.looks.add([d.kind, d.babies, d.col, d.size.toFixed(3), d.neck.toFixed(3), d.tail.toFixed(3), d.wing.toFixed(3), d.r.toFixed(1), d.flap.toFixed(3)].join('|'));
        if ((out.perKind[d.kind] = (out.perKind[d.kind] || 0) + 1) > 12) continue;   // 12 of each kind are watched for two minutes
        let lo = Infinity, hi = -Infinity;
        for (let t = 1000; t < 1120; t += 0.5) {
          const p = G.dragonPose(gx, gz, t), a = G.dragonPose(gx, gz, t - 0.25), b = G.dragonPose(gx, gz, t + 0.25);
          const way = Math.atan2(b.x - a.x, b.z - a.z);
          out.worst = Math.max(out.worst, deg(diff(p.yaw, way)));
          out.lean = Math.max(out.lean, deg(Math.abs(p.roll))); out.tip = Math.max(out.tip, deg(Math.abs(p.pitch)));
          if (p.flaps) out.flaps++; else out.glides++;
          lo = Math.min(lo, p.y); hi = Math.max(hi, p.y);
          if (p.speed < 1) out.flat++;
        }
      }
      out.looks = out.looks.size; out.nearLooks = out.nl ? out.nl.size : 0; delete out.nl;
      return out;
    });
    assert.ok(r.n > 2000, 'dragons looked at: ' + r.n);
    assert.ok(r.worst <= 10, 'facing is within 10 degrees of the way it moves: worst ' + r.worst.toFixed(1));
    assert.ok(r.lean <= 35.01 && r.lean > 5, 'leans into turns, at most 35 degrees: ' + r.lean.toFixed(1));
    assert.ok(r.tip <= 25.01 && r.tip > 1, 'tips its nose, at most 25 degrees: ' + r.tip.toFixed(1));
    assert.ok(r.flaps > 0 && r.glides > 0, 'flaps and glides');
    assert.equal(r.flat, 0, 'no dragon stops in mid-air');
    const share = k => (r.kinds[k] || 0) / r.n * 100;
    for (const [k, w] of [['drake', 45], ['wyvern', 30], ['great', 15], ['family', 10]]) assert.ok(Math.abs(share(k) - w) <= 5, k + ': ' + share(k).toFixed(1) + ' for a weight of ' + w);
    assert.ok(Math.abs(r.rare / r.n * 100 - 5) <= 5 && r.rare > 0, 'rare colours about 1 in 20: ' + (r.rare / r.n * 100).toFixed(1));
    assert.ok(r.near >= 10 && r.nearLooks === r.near, 'near the start, no two dragons look and fly the same: ' + r.nearLooks + ' of ' + r.near);
    // a kind set to 0 no longer appears
    const none = await page.evaluate(() => { const G = window.gameTest; G.setDragonWeights({ dragon_w_drake: 0, dragon_w_wyvern: 30, dragon_w_great: 15, dragon_w_family: 0 }); let n = 0; for (let gx = -15; gx < 15; gx++) for (let gz = -15; gz < 15; gz++) { const d = G.dragonOf(gx, gz); if (d && (d.kind === 'drake' || d.babies)) n++; } G.setDragonWeights({}); return n; });
    assert.equal(none, 0);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [phoneGame()] }));

test('SPEC-033: coming down to eat, the dragon faces the way it moves, lands and sits on the ground facing the tree, and takes off head first; the models load and are drawn', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameTest && window.gameTest.dragonsNear && window.gameTest.dragonsNear().length > 0, null, { timeout: 150000 });
    await page.waitForFunction(() => window.gameTest.dragons().length > 0, null, { timeout: 150000 });   // the model file has loaded and a dragon is drawn
    const r = await page.evaluate(() => {
      const G = window.gameTest, d = G.dragonsNear()[0], [gx, gz] = d.id.split(':').map(Number), t0 = G.sharedNow / 1000 + 100;
      const deg = a => a * 180 / Math.PI, diff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
      const land = { lx: d.x + 30, ly: 24, lz: d.z + 20 };
      G.startEat({ id: d.id, tx: Math.floor(land.lx + 3), ty: 23, tz: Math.floor(land.lz), ...land, t0 });
      let worst = 0; const states = new Set();
      for (let tau = 0.5; tau < 19.6; tau += 0.25) {
        const t = t0 + tau, p = G.dragonPose(gx, gz, t), a = G.dragonPose(gx, gz, t - 0.2), b = G.dragonPose(gx, gz, t + 0.2);
        states.add(p.state);
        if (p.state === 'eat' || p.state === 'sit' || a.state !== b.state || p.speed < 1) continue;
        worst = Math.max(worst, deg(diff(p.yaw, Math.atan2(b.x - a.x, b.z - a.z))));
      }
      const sit = G.dragonPose(gx, gz, t0 + 10), face = Math.atan2(Math.floor(land.lx + 3) + 0.5 - land.lx, Math.floor(land.lz) + 0.5 - land.lz);
      return { worst, states: [...states], sit, off: deg(diff(sit.yaw, face)), land, flare: G.dragonPose(gx, gz, t0 + 7.6).flaps, glide: G.dragonPose(gx, gz, t0 + 3).flaps, up: G.dragonPose(gx, gz, t0 + 16).flaps };
    });
    assert.deepEqual(r.states.sort(), ['down', 'eat', 'sit', 'up']);
    assert.ok(r.worst <= 10, 'head first coming down and going up: worst ' + r.worst.toFixed(1));
    assert.ok(Math.abs(r.sit.x - r.land.lx) < 0.01 && Math.abs(r.sit.y - r.land.ly) < 0.01, 'it sits where it landed, without sliding');
    assert.ok(r.off < 1 && r.sit.pitch === 0 && r.sit.roll === 0, 'sitting level, facing the tree');
    assert.equal(r.glide, false, 'glides in'); assert.equal(r.flare, true, 'beats its wings to slow down'); assert.equal(r.up, true, 'takes off with wing beats');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [phoneGame()] }));

// ---- Dragons land everywhere and eat fish (0.6.95, SPEC-036) ----
test('SPEC-036: a dragon rests on top of the blocks for its time and takes off; a fish catch dives to the water, skims with the fish, carries it to a perch and eats it; places keep the landing distance', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameTest && window.gameTest.dragonsNear && window.gameTest.dragonsNear().length > 0, null, { timeout: 150000 });
    const r = await page.evaluate(() => {
      const G = window.gameTest, d = G.dragonsNear()[0], [gx, gz] = d.id.split(':').map(Number), t0 = G.sharedNow / 1000 + 200, pos = G.pos;
      const deg = a => a * 180 / Math.PI, diff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
      const out = {};
      // a perch near the child: on top of a solid block with air above, not closer than the landing distance
      const spot = G.pickPerch();
      out.spot = spot && { on: G.isSolid(G.blockAt(Math.floor(spot.lx), spot.ly - 1, Math.floor(spot.lz))), air: G.blockAt(Math.floor(spot.lx), spot.ly, Math.floor(spot.lz)) === 0, far: Math.hypot(spot.lx - pos[0], spot.lz - pos[2]) >= G.dragonGap, kind: spot.kind };
      out.gap = G.dragonGap;
      // a rest of 20 seconds
      const L = { lx: d.x + 25, ly: 30, lz: d.z + 15 };
      G.setDragonEatForTest({ id: d.id, tx: Math.floor(L.lx) + 2, ty: 29, tz: Math.floor(L.lz), ...L, t0, what: 'rest', dur: 20, marked: true });
      out.times = G.landTimes({ what: 'rest', dur: 20 });
      const st = tau => G.dragonPose(gx, gz, t0 + tau);
      out.rest = [4, 9, 20, 27.5, 30, 33.5].map(tau => st(tau).state);
      const sit = st(15); out.sitAt = [sit.x - L.lx, sit.y - L.ly, sit.z - L.lz].map(v => Math.abs(v) < 0.01);
      // a fish catch
      const W = { wx: d.x - 20, wy: 9, wz: d.z + 30 };
      G.setDragonEatForTest({ id: d.id, tx: Math.floor(W.wx), ty: 8, tz: Math.floor(W.wz), ...L, ...W, t0, what: 'fish', marked: true });
      out.fish = [3, 6.5, 10, 15, 19, 22, 26].map(tau => { const p = st(tau); return p.state + (p.fish ? '+fish' : ''); });
      const skim = st(6.7); out.skimY = Math.abs(skim.y - (W.wy + 0.7)) < 0.01;
      let worst = 0;
      for (let tau = 0.5; tau < 25; tau += 0.25) { const p = st(tau), a = st(tau - 0.2), b = st(tau + 0.2); if (p.state === 'eat' || p.state === 'sit' || a.state !== b.state || p.speed < 1) continue; worst = Math.max(worst, deg(diff(p.yaw, Math.atan2(b.x - a.x, b.z - a.z)))); }
      out.worst = worst;
      G.setDragonEatForTest(null);
      return out;
    });
    assert.ok(r.spot && r.spot.on && r.spot.air && r.spot.far, 'a resting place: ' + JSON.stringify(r.spot));
    assert.equal(r.gap, 3);
    assert.deepEqual(r.times, { land: 8, eatEnd: 8, sitEnd: 28, end: 33 });
    assert.deepEqual(r.rest, ['down', 'sit', 'sit', 'sit', 'up', 'fly']);
    assert.deepEqual(r.sitAt, [true, true, true], 'it sits where it landed');
    assert.deepEqual(r.fish, ['down', 'skim+fish', 'carry+fish', 'eat+fish', 'sit', 'up', 'fly']);
    assert.equal(r.skimY, true, 'it skims just over the water');
    assert.ok(r.worst <= 10, 'head first through the dive, the skim and the flight to its perch: ' + r.worst.toFixed(1));
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [phoneGame()] }));

// ---- Believable monsters (0.6.96, SPEC-035) ----
test('SPEC-035: every kind is an animated model with one of its looks; walking, each faces the way it walks (within 15 degrees) and its walk is played at the speed it moves; a hit makes it flinch and a defeat makes it fall with its own animation', { skip, timeout: 300000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameTest && window.gameTest.monsters, null, { timeout: 60000 });
    await page.evaluate(() => { const g = window.gameTest, [x, y, z] = g.pos.map(Math.floor); for (let dx = -22; dx <= 22; dx++) for (let dz = -22; dz <= 22; dz++) { g.setWriteBlock(x + dx, y - 1, z + dz, g.T.GRASS); for (let u = 0; u < 6; u++) g.setWriteBlock(x + dx, y + u, z + dz, 0); } g.clearEnemies(); });
    const made = await page.evaluate(() => { const g = window.gameTest, out = {}; for (const k of ['goblin', 'imp', 'brute', 'spear', 'hood', 'spike']) { out[k] = 0; for (let i = 0; i < 6 && out[k] < 2; i++) if (g.spawnKind(k)) out[k]++; } return out; });
    for (const k of Object.keys(made)) assert.ok(made[k] >= 1, 'a ' + k + ' was made');
    await page.waitForFunction(() => { const m = window.gameTest.monsters(); return m.length >= 6 && m.every(x => x.hasAnim); }, null, { timeout: 120000 });
    const looks = await page.evaluate(() => window.gameTest.monsters().map(m => [m.kind, m.look, window.gameTest.monsterLook(m.kind, m.id)]));
    const allowed = { goblin: ['goblin-orc-enemy', 'goblin-tribal'], brute: ['brute-yeti', 'brute-orc', 'brute-blue-demon', 'brute-big-arm'], spear: ['spear-imp-demon-2', 'spear-imp-demon'], hood: ['hood-goblin-ninja', 'hood-goblin-ninja-2'], imp: ['imp'], spike: ['spike'] };
    for (const [kind, look, again] of looks) { assert.ok(allowed[kind].includes(look), kind + ' looks like ' + look); if (kind !== 'imp' && kind !== 'spike') assert.equal(again, look, 'the look comes from the monster\'s own number'); }
    // watch them walk for a while: facing, and the walk's speed
    const seen = await page.evaluate(async () => {
      const g = window.gameTest, deg = a => Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) * 180 / Math.PI, out = { worst: 0, walking: 0, walkAnim: 0, idleAnim: 0, scales: [] };
      for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 100));
        for (const m of g.monsters()) {
          if (m.walked > 0.5 && !m.turning && (m.vx || m.vz)) { out.walking++; out.worst = Math.max(out.worst, deg(m.yaw - Math.atan2(m.vx, m.vz))); if (m.anim === 'walk') out.walkAnim++; if (m.stride > 0) out.scales.push(m.timeScale * m.stride / m.walked); }
          else if (!m.vx && !m.vz && m.anim === 'idle') out.idleAnim++;
        }
      }
      return out;
    });
    assert.ok(seen.walking > 20, 'monsters were seen walking: ' + seen.walking);
    assert.ok(seen.worst <= 15, 'facing within 15 degrees while walking: worst ' + seen.worst.toFixed(1));
    assert.ok(seen.walkAnim >= seen.walking * 0.9, 'the walk animation plays while walking');
    assert.ok(seen.idleAnim > 0, 'the idle animation plays while standing');
    // a hit: it flinches (its life drops, the fight goes on as before); a defeat: it falls and stays as a body
    const fight = await page.evaluate(async () => {
      const g = window.gameTest, m = g.monsters().find(x => x.kind === 'brute');
      const before = m.hp; g.hurtById(m.id, 1); await new Promise(r => setTimeout(r, 300));
      const mid = g.monsters().find(x => x.id === m.id);
      const bodies = g.corpseList.length; g.hurtById(m.id, 99); await new Promise(r => setTimeout(r, 300));
      return { before, after: mid.hp, flinch: g.monsterOnce(m.id), gone: !g.monsters().some(x => x.id === m.id), bodies: g.corpseList.length - bodies, fell: g.lastBody() };
    });
    assert.equal(fight.after, fight.before - 1 >= 0 ? fight.after : fight.after);
    assert.ok(fight.after < fight.before, 'the hit took life');
    assert.equal(fight.gone, true); assert.equal(fight.bodies, 1);
    assert.deepEqual(fight.fell, { fallen: true, onSide: false }, 'it fell with its own animation, not laid on its side');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [phoneGame()] }));

// ---- Birds for every part of the world (0.6.97, SPEC-034) ----
test('SPEC-034: each kind of bird lives only in its own part of the world; flying birds fly head first; penguins never fly; at most 40 birds are drawn in a few draws; birds move away from a child and settle further off', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameTest && window.gameTest.birdGroup, null, { timeout: 60000 });
    const r = await page.evaluate(() => {
      const G = window.gameTest, deg = a => Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) * 180 / Math.PI;
      const out = { kinds: {}, wrong: [], worst: 0, flew: {}, penguinFlies: 0, n: 0 };
      const where = { songbird: ['grassland', 'forest', 'savanna', 'taiga'], parrot: ['rainforest'], owl: ['forest', 'taiga'], duck: ['grassland', 'forest', 'taiga'], penguin: ['tundra'], geese: ['grassland', 'forest', 'taiga'], hawk: ['grassland', 'savanna', 'desert'] };
      for (let cx = -45; cx < 45; cx++) for (let cz = -45; cz < 45; cz++) {
        const g = G.birdGroup(cx, cz);
        if (!g) continue;
        out.n++; out.kinds[g.kind] = (out.kinds[g.kind] || 0) + 1;
        if (g.kind === 'gull' ? g.biome === 'tundra' || !g.water : !where[g.kind].includes(g.biome)) out.wrong.push([g.kind, g.biome]);
        if ((g.kind === 'duck' || g.kind === 'gull') !== g.water) out.wrong.push([g.kind, 'water ' + g.water]);
        if ((out.flew[g.kind] = (out.flew[g.kind] || 0) + 1) > 6) continue;   // six groups of each kind are watched for a minute
        for (let t = 5000; t < 5060; t += 0.5) {
          const p = G.birdPose(cx, cz, 0, t);
          if (g.kind === 'penguin' && p.fly) out.penguinFlies++;
          if (!p.fly || p.hide) continue;
          const a = G.birdPose(cx, cz, 0, t - 0.2), b = G.birdPose(cx, cz, 0, t + 0.2);
          if (!a.fly || !b.fly || Math.hypot(b.x - a.x, b.z - a.z) < 0.3) continue;
          out.worst = Math.max(out.worst, deg(p.yaw - Math.atan2(b.x - a.x, b.z - a.z)));
        }
      }
      return out;
    });
    assert.deepEqual(r.wrong, [], 'a bird outside its part of the world');
    for (const k of ['songbird', 'parrot', 'owl', 'duck', 'penguin', 'gull', 'geese', 'hawk']) assert.ok(r.kinds[k] > 0, 'no ' + k + ' in 8,100 squares: ' + JSON.stringify(r.kinds));
    assert.ok(r.worst <= 10, 'flying birds face the way they fly: worst ' + r.worst.toFixed(1));
    assert.equal(r.penguinFlies, 0, 'penguins never fly');
    // near the child: at most 40 birds, in at most one draw for each kind and one for the wings; nothing is inside a block
    await page.waitForTimeout(1500);
    const near = await page.evaluate(() => { const G = window.gameTest, b = G.birds(), d = G.birdDraws(); return { n: b.length, draws: d, inside: b.filter(x => !x.fly && G.isSolid(G.blockAt(Math.floor(x.x), Math.floor(x.y + 0.05), Math.floor(x.z)))).length, wings: d.wings }; });
    assert.ok(near.n <= 40); assert.equal(near.wings, near.n * 2); assert.equal(near.inside, 0, 'a bird is inside a block');
    assert.equal(Object.keys(near.draws.bodies).length, 8);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [phoneGame()] }));

test('SPEC-034: songbirds move away when a child walks up to them and settle 20 to 40 blocks away, never on the child; hawks and geese stay high', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameTest && window.gameTest.birdGroup, null, { timeout: 60000 });
    const r = await page.evaluate(async () => {
      const G = window.gameTest, find = kind => { for (let r = 0; r < 40; r++) for (let cx = -r; cx <= r; cx++) for (let cz = -r; cz <= r; cz++) { if (Math.max(Math.abs(cx), Math.abs(cz)) !== r) continue; const g = G.birdGroup(cx, cz); if (g && g.kind === kind) return { cx, cz, g }; } return null; };
      const s = find('songbird'), h = find('hawk');
      const before = G.birdHome(s.cx, s.cz);
      G.setPos(s.g.x + 2, 60, s.g.z + 1);
      const after = G.birdHome(s.cx, s.cz), pos = G.pos;
      const again = G.birdHome(s.cx, s.cz);
      G.setPos(h.g.x, 60, h.g.z);
      const hawk = G.birdHome(h.cx, h.cz), hp = G.birdPose(h.cx, h.cz, 0, G.sharedNow / 1000);
      return { before, after, again, away: Math.hypot(after.hx - before.hx, after.hz - before.hz), fromChild: Math.hypot(after.hx - pos[0], after.hz - pos[2]), hawk, hawkUp: hp.y, hawkFly: hp.fly };
    });
    assert.equal(r.before.moving, false); assert.equal(r.after.moving, true, 'the flock moves off');
    assert.ok(r.away >= 20 && r.away <= 40, 'it settles 20 to 40 blocks away: ' + r.away.toFixed(1));
    assert.ok(r.fromChild >= 12, 'not on the child');
    assert.deepEqual([r.again.hx, r.again.hz], [r.after.hx, r.after.hz], 'it does not jump about while it is moving');
    assert.equal(r.hawk.moving, false, 'a hawk stays high'); assert.equal(r.hawkFly, true); assert.ok(r.hawkUp > 40);
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { saves: [phoneGame()] }));

// ---- Bird facts (0.6.98, SPEC-037) ----
const FACTS = (() => { const o = {}; for (let i = 1; i <= 12; i++) o[i] = ['penguin', `Penguins slide ${i}.`, `Penguins slide on snow ${i}.`, `Penguins slide on their bellies ${i}.`, `Penguins slide on their bellies over the snow ${i}.`, `Penguins toboggan, which means sliding on their bellies over snow and ice, ${i}.`]; o[50] = ['duck', 'Ducks swim.', 'Ducks swim well.', 'Ducks swim well.', 'Ducks swim well.', 'Ducks swim well.']; return o; })();
test('SPEC-037: a click on a bird opens its card with picture, name and a fact for the Words level; it never digs or fights, the game keeps running; ten taps give ten different facts; the flag hides a fact; X, a tap elsewhere and 12 seconds close it', { skip, timeout: 300000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => !!window.gameTest, null, { timeout: 60000 });
    await page.goto(page.url().split('?')[0] + '?birds=penguin', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.gameTest && window.gameTest.facts && window.gameTest.birds().length > 0, null, { timeout: 90000 });
    await page.evaluate(F => { const G = window.gameTest; G.facts.set(F); G.setQuizLevels({ band: 0, math: { use: 1, best: 1 }, words: { use: 5, best: 5, fast: false } }); }, FACTS);
    // no downloaded fact for a kind (a new device opened offline, or an empty pool): a fact that comes with the game (0.6.101)
    const bare = await page.evaluate(() => { const G = window.gameTest; G.facts.open('owl'); const c = G.facts.card(); G.facts.close(); G.facts.wait(5000); return { ...c, own: G.facts.builtIn.owl.map(f => f[0]) }; });
    assert.equal(bare.name, 'Owl'); assert.match(String(bare.id), /^b-owl-\d$/); assert.ok(bare.own.includes(bare.fact), 'a built-in fact in the version for Words level 5: ' + bare.fact);
    assert.ok(bare.fact.split(/\s+/).length <= 10); assert.equal(bare.flag, true, 'it has the flag too'); assert.equal(bare.picture, true, 'the picture is drawn from the bird\'s own shape');
    // a real click on a bird
    const spot = async () => { for (let i = 0; i < 40; i++) { const s = await page.evaluate(() => { const G = window.gameTest, P = G.pos, b = G.birds().sort((a, c) => Math.hypot(a.x - P[0], a.z - P[2]) - Math.hypot(c.x - P[0], c.z - P[2]))[0]; if (!b) return null; const d = Math.hypot(b.x - P[0], b.z - P[2]); if (d > 16) { G.setPos(b.x + (P[0] - b.x) / d * 12, P[1] + 3, b.z + (P[2] - b.z) / d * 12); return null; } G.facts.faceTo(b.x, b.z); return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => { const s = G.facts.screen(b); r(s.front && s.x > 20 && s.x < innerWidth - 20 && s.y > 20 && s.y < innerHeight - 20 && G.facts.tapAt(s.x, s.y) ? s : null); }))); }); if (s) return s; await page.waitForTimeout(250); } return null; };
    let s = null;   // the birds walk about: up to 3 tries, as on the test phone
    for (let i = 0; i < 3; i++) { s = await spot(); assert.ok(s, 'a penguin can be found under the pointer'); await page.mouse.click(s.x, s.y); if (await page.evaluate(() => !!window.gameTest.facts.card())) break; }
    const first = await page.evaluate(() => { const G = window.gameTest; return { card: G.facts.card(), paused: G.paused, digging: !!G.digging, fight: !!G.fight }; });
    assert.ok(first.card && first.card.shown, 'the card opens'); assert.equal(first.card.name, 'Penguin'); assert.equal(first.card.band, 1);
    assert.match(first.card.fact, /^Penguins slide \d+\.$/, 'the version for Words level 5');
    assert.ok(first.card.fact.split(/\s+/).length <= 10); assert.equal(first.card.flag, true);
    assert.equal(first.paused, false, 'the game keeps running'); assert.equal(first.digging, false); assert.equal(first.fight, false);
    // a right-click on a bird places nothing
    const blocks = () => page.evaluate(() => JSON.stringify(window.gameProbe ? (window.gameProbe().changed || 0) : 0));
    const b0 = await blocks(); await page.mouse.click(s.x, s.y, { button: 'right' }); assert.equal(await blocks(), b0);
    // ten taps in a row: ten different facts; then they start again; level 90 gives the long version of at most 20 words
    const ten = await page.evaluate(() => { const G = window.gameTest, out = []; G.facts.close(); for (let i = 0; i < 12; i++) { G.facts.wait(5000); G.facts.open('penguin'); out.push(G.facts.card().id); G.facts.close(); } G.facts.wait(5000); G.facts.open('penguin'); const again = G.facts.card().id; G.facts.close();
      G.setQuizLevels({ band: 0, math: { use: 1, best: 1 }, words: { use: 90, best: 90, fast: false } }); G.facts.wait(5000); G.facts.open('penguin'); const long = G.facts.card(); G.facts.close(); return { out, again, long }; });
    assert.equal(new Set(ten.out.slice(0, 10)).size, 10, 'ten different facts'); assert.equal(new Set(ten.out).size, 12);
    assert.equal(ten.again, ten.out[0], 'all seen: they start again, oldest seen first');
    assert.equal(ten.long.band, 5); assert.match(ten.long.fact, /toboggan/); assert.ok(ten.long.fact.split(/\s+/).length <= 20);
    // the 2 seconds after a card closes, the X, a tap elsewhere, the flag
    const r = await page.evaluate(async () => {
      const G = window.gameTest, out = {};
      G.facts.wait(5000); G.facts.open('duck'); G.facts.close(); out.tooSoon = G.facts.open('duck');
      G.facts.wait(5000); out.opened = G.facts.open('duck'); out.duck = G.facts.card();
      document.querySelector('#birdCard .bcX').click(); out.afterX = G.facts.card();
      G.facts.wait(5000); G.facts.open('duck');
      document.querySelector('#birdCard [data-aiflag]').click();
      out.thanks = document.querySelector('#birdCard .aiThanks').textContent; out.report = G.lastReport && G.lastReport();
      G.facts.close(); G.facts.wait(5000); G.facts.open('duck'); out.afterFlag = G.facts.card(); G.facts.close();
      out.font = parseFloat(getComputedStyle(Object.assign(document.body.appendChild(document.createElement('div')), { id: 'x' })).fontSize);
      return out;
    });
    assert.equal(r.tooSoon, false, 'no new card for 2 seconds'); assert.equal(r.opened, true); assert.equal(r.duck.name, 'Duck'); assert.equal(r.afterX, null, 'X closes it');
    assert.equal(r.thanks, 'Thank you! A grown-up will check it.'); assert.notEqual(r.afterFlag.id, '50', 'the flagged fact is hidden on this device'); assert.match(String(r.afterFlag.id), /^b-duck-\d$/, 'with no other downloaded duck fact, the game\'s own facts take over');
    await page.evaluate(() => { window.gameTest.facts.wait(5000); window.gameTest.facts.open('penguin'); });
    await page.mouse.click(5, 300);
    assert.equal(await page.evaluate(() => window.gameTest.facts.card()), null, 'a tap elsewhere closes it');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { device: PC, saves: [phoneGame()] }));

test('SPEC-037: on a phone the fact is at least 20 px, the card is at the side and its buttons are big enough; the card closes by itself after 12 seconds', { skip, timeout: 240000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameTest && window.gameTest.facts, null, { timeout: 60000 });
    const r = await page.evaluate(F => { const G = window.gameTest; G.facts.set(F); G.facts.open('penguin'); const el = document.getElementById('birdCard'), box = el.getBoundingClientRect(), x = el.querySelector('.bcX').getBoundingClientRect(), f = el.querySelector('[data-aiflag]').getBoundingClientRect();
      return { fact: parseFloat(getComputedStyle(el.querySelector('.bcFact')).fontSize), name: parseFloat(getComputedStyle(el.querySelector('.bcName')).fontSize), left: box.left, right: innerWidth - box.right, w: box.width, h: box.height, ih: innerHeight, iw: innerWidth, x: [x.width, x.height], f: [f.width, f.height], inputs: el.querySelectorAll('input,textarea').length }; }, FACTS);
    assert.ok(r.fact >= 20, 'fact text ' + r.fact); assert.ok(r.name >= 24);
    assert.ok(r.left > r.iw / 2 && r.right >= 0, 'at the side of the screen'); assert.ok(r.h <= r.ih, 'fits the screen');
    assert.ok(Math.min(...r.x, ...r.f) >= 48, 'buttons of 48 px'); assert.equal(r.inputs, 0);
    await page.waitForTimeout(12600);
    assert.equal(await page.evaluate(() => window.gameTest.facts.card()), null, 'it closes by itself after 12 seconds');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { device: PHONE_WIDE, saves: [phoneGame()] }));

// ---- Insights in the admin page (SPEC-040) ----
test('SPEC-040: Insights draws a chart for every record kind it is given (also one never seen before), with numbers, CSV and errors by version, and shows no code', { skip, timeout: 180000 }, () =>
  withGame(async (page, errors) => {
    await page.goto(new URL('/admin.html', page.url()).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.insightsTest, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => document.getElementById('insightsBar').classList.contains('hide') && document.getElementById('insightsCard').classList.contains('hide')), true, 'signed out: Insights is not shown');
    const r = await page.evaluate(() => {
      const day = i => new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      window.insightsTest.render({ days: 30, versions: ['0.6.97', '0.6.98'],
        activity: [{ day: day(0), kind: 'session_start', n: 12 }, { day: day(1), kind: 'session_start', n: 7 }, { day: day(0), kind: 'enemy_defeated', n: 30 }, { day: day(3), kind: 'a_kind_never_seen_before', n: 2 }],
        visits: [{ day: day(0), visits: 10, shared: 4 }, { day: day(1), visits: 6, shared: 0 }],
        errors: [{ day: day(0), version: '0.6.98', n: 5 }, { day: day(0), version: '0.6.97', n: 1 }, { day: day(2), version: '0.6.97', n: 3 }],
        top_errors: [{ message: 'Cannot read  of undefined', where_seen: 'draw', n: 9, first_day: day(2), last_day: day(0), versions: ['0.6.97', '0.6.98'], stack: 'at draw (game:1:2)' }] });
      const card = document.getElementById('insightsCard'), out = {};
      out.kinds = [...card.querySelectorAll('[data-inskind]')].map(b => b.dataset.inskind);
      out.svgs = card.querySelectorAll('svg').length; out.csvButtons = card.querySelectorAll('[data-csv]').length; out.tables = card.querySelectorAll('table').length;
      out.csv = window.insightsTest.csv();
      out.stats = [...card.querySelectorAll('#insActivity .stat b')].map(b => b.textContent);
      out.errRects = card.querySelectorAll('#insErrors svg rect').length;
      out.axis = [...card.querySelector('#insActivity svg').querySelectorAll('text')].map(t => t.textContent);
      card.querySelector('[data-inserr="0"]').click(); out.stack = !document.getElementById('insStack0').classList.contains('hide') && document.getElementById('insStack0').textContent;
      card.querySelector('[data-inskind="enemy_defeated"]').click();
      window.insightsTest.details('enemy_defeated', [{ detail: 'imp', n: 20 }, { detail: 'puglin', n: 10 }]);
      out.detail = document.getElementById('insDetails').textContent; out.kindChart = !!document.querySelector('#insKindDetail svg');
      out.text = [...card.querySelectorAll('td,th,b,span,text,title,div.muted')].map(e => e.textContent).join(' | '); out.versions = [...document.querySelectorAll('#insVersion option')].map(o => o.value);
      out.wide = card.scrollWidth <= card.clientWidth + 1;
      return out;
    });
    assert.deepEqual(r.kinds, ['enemy_defeated', 'session_start', 'a_kind_never_seen_before'], 'every kind, sorted by how many, with no change to the page for a new one');
    assert.deepEqual(r.stats, ['51', '3', '16', '25%']);
    assert.ok(r.svgs >= 7, 'charts: ' + r.svgs); assert.ok(r.csvButtons >= 5); assert.ok(r.tables >= 5, 'each chart has its numbers');
    assert.match(r.csv.records, /^Day,Records\n/); assert.match(r.csv.records, /,42$/);
    assert.match(r.csv.errors, /^Day,0\.6\.97,0\.6\.98\n/); assert.match(r.csv.all_kinds, /^Day,enemy_defeated,session_start,a_kind_never_seen_before\n/);
    assert.match(r.csv.top_errors, /Cannot read  of undefined,draw,9,/);
    assert.equal(r.errRects, 3, 'errors per day are split by version'); assert.ok(r.axis.includes('Day') && r.axis.includes('Records'), 'labels on both axes');
    assert.match(r.stack, /at draw/); assert.match(r.detail, /imp/); assert.equal(r.kindChart, true);
    assert.deepEqual(r.versions, ['', '0.6.97', '0.6.98']);
    assert.ok(!(r.text.match(/\b[a-z0-9]{16,}\b/g) || []).some(w => /[0-9]/.test(w) && /[a-z]/.test(w)), 'no visit code is shown: ' + (r.text.match(/\b[a-z0-9]{16,}\b/g) || []).join(' '));
    assert.deepEqual(errors.filter(e => !/supabase|Failed to load|net::/i.test(e)), [], 'errors: ' + errors.join(' | '));
  }, { device: PC, saves: [phoneGame()] }));

// ---- Living world (0.6.99, SPEC-026) ----
test('SPEC-026: digging, placing, landing and gems make small effects (60 at most, 1.5 seconds at most, one draw); a leaf falls near a tree; plants lean with the wind and trunks do not; Calm motion stops it all; the ground is varied the same way every time', { skip, timeout: 300000 }, () =>
  withGame(async (page, errors) => {
    await page.waitForFunction(() => window.gameTest && window.gameTest.fx && window.gameTest.fx.windy().grass, null, { timeout: 90000 });
    await page.waitForTimeout(1500);
    if (process.env.SHOT) await page.screenshot({ path: '/tmp/view/world.png' });
    const r = await page.evaluate(async () => {
      const G = window.gameTest, F = G.fx, T = F.T, out = {}, P = G.pos, wait = ms => new Promise(ok => setTimeout(ok, ms));
      const x = Math.floor(P[0]) + 2, y = Math.floor(P[1]) + 1, z = Math.floor(P[2]);
      F.clear(); F.block(x, y, z, T.GRASS, false); out.dig = F.list().filter(p => p.kind === 'dig').length; out.digCols = new Set(F.list().map(p => p.col)).size;
      F.block(x, y, z, T.STONE, true); out.place = F.list().filter(p => p.kind === 'place').length;
      F.dust(P[0], P[1], P[2]); out.dust = F.list().filter(p => p.kind === 'dust').length;
      F.sparkle(P[0], P[1] + 1, P[2]); out.sparkle = F.list().filter(p => p.kind === 'sparkle').length;
      for (let i = 0; i < 20; i++) F.block(x, y, z, T.DIRT, false);
      out.most = F.list().length; out.lives = Math.max(...F.list().map(p => p.life));
      await wait(300); out.draws = F.draws(); out.wind1 = F.wind();
      // (the test browser draws only a few frames a second, and the effects' clock follows the frames)
      for (let i = 0; i < 200 && F.list().some(p => p.kind !== 'leaf'); i++) await wait(250);
      out.after = F.list().filter(p => p.kind !== 'leaf').length; out.wind2 = F.wind();
      // a leaf: asked for many times, as the game does every 5 seconds
      const tree = F.tree(P[0], P[2], 80); out.tree = !!tree;
      if (tree) { G.setPos(tree.x + 3, P[1] + 6, tree.z + 3); await wait(500); }
      const P2 = G.pos; P[0] = P2[0]; P[1] = P2[1]; P[2] = P2[2];
      let leaf = null; for (let i = 0; i < 400 && !leaf; i++) { if (F.leaf()) leaf = F.list().find(p => p.kind === 'leaf'); }
      out.leaf = leaf && { d: Math.hypot(leaf.x - P[0], leaf.z - P[2]) };
      if (leaf) { for (let i = 0; i < 200 && F.list().some(p => p.kind === 'leaf'); i++) await wait(250); out.leafGone = !F.list().some(p => p.kind === 'leaf'); }
      out.windy = F.windy();
      // Calm motion: nothing shows and nothing can be added
      F.setCalm(true); out.calmList = F.list().length; F.block(x, y, z, T.GRASS, false); F.sparkle(P[0], P[1], P[2]); out.calmAdd = F.list().length; out.calmWind = F.wind().on; out.calmLeaf = F.leaf();
      F.setCalm(false); out.backOn = F.wind().on;
      // ground variety: from the block's place only
      const looks = []; for (let i = 0; i < 400; i++) looks.push(F.look(200000 + i, 12, 200000 + (i * 7) % 31, 4));
      out.turns = [0, 1, 2, 3].map(k => looks.filter(l => l.turn === k).length); out.shadeMin = Math.min(...looks.map(l => l.shade)); out.shadeMax = Math.max(...looks.map(l => l.shade));
      out.same = JSON.stringify(F.look(200011, 12, 200007, 24)) === JSON.stringify(F.look(200011, 12, 200007, 24));
      out.ways = { grass: F.turns(T.GRASS), dirt: F.turns(T.DIRT), sand: F.turns(T.SAND), snow: F.turns(T.SNOW), stone: F.turns(T.STONE), gem: F.turns(T.GEM), castle: F.turns(T.CSTONE), roof: F.turns(T.ROOF), wood: F.turns(T.WOOD) };
      return out;
    });
    assert.equal(r.dig, 8, 'a dug block throws bits'); assert.ok(r.digCols > 1, 'in the block\'s colours, a little varied'); assert.equal(r.place, 4, 'a placed block makes a smaller puff');
    assert.equal(r.dust, 8); assert.equal(r.sparkle, 8);
    assert.equal(r.most, 60, 'at most 60 at once'); assert.ok(r.lives <= 1.5, 'each lasts at most 1.5 seconds'); assert.ok(r.draws > 0 && r.draws <= 60);
    assert.equal(r.after, 0, 'they are gone after 1.5 seconds'); assert.ok(r.wind2.t > r.wind1.t, 'the wind moves on');
    assert.ok(r.tree, 'there is a tree within 80 blocks of the start'); assert.ok(r.leaf, 'a leaf falls from a tree near the player'); assert.ok(r.leaf.d <= 22, 'within 20 blocks: ' + r.leaf.d); assert.equal(r.leafGone, true);
    for (const k of ['grass', 'flower', 'plant', 'bush']) { const [a, b] = r.windy[k].split('/').map(Number); assert.ok(a === b && b > 0, k + ' moves: ' + r.windy[k]); }
    for (const k of ['common', 'pine', 'palm']) { const [a, b] = r.windy[k].split('/').map(Number); assert.ok(a > 0 && a < b, k + ': the top moves, the trunk does not: ' + r.windy[k]); }
    for (const k of ['mushroom', 'stone', 'stump', 'cactus', 'snowman']) assert.match(r.windy[k], /^0\//, k + ' stays still');
    assert.equal(r.calmList, 0); assert.equal(r.calmAdd, 0); assert.equal(r.calmWind, 0); assert.equal(r.calmLeaf, false); assert.equal(r.backOn, 1);
    assert.ok(r.turns.every(n => n > 50), 'all four turns are used: ' + r.turns); assert.ok(r.shadeMin >= 0.95 && r.shadeMax <= 1.05 && r.shadeMax - r.shadeMin > 0.08, 'up to 5% lighter or darker');
    assert.equal(r.same, true);
    assert.deepEqual(r.ways, { grass: 4, dirt: 24, sand: 24, snow: 24, stone: 24, gem: 0, castle: 0, roof: 0, wood: 0 });
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { device: PC, saves: [phoneGame()] }));

// ---- Teacher Mirelo, built-in talks (0.6.103; the first part of SPEC-027) ----
test('Teacher Mirelo (owner\'s preview): the AI greeting, words or maths, a talk with answers from the game, Show me, Why, easier and harder, the answer after two wrong tries, 12 replies at most, no gems, nothing typed, nothing sent', { skip, timeout: 300000 }, () =>
  withGame(async (page, errors, requests) => {
    await page.waitForFunction(() => window.gameTest && window.gameTest.teach, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => window.gameTest.teach.on), false, 'without the switch there is no Teacher Mirelo');
    await playing(page);
    // the switch is the owner's preview in the parent area (0.6.104); here it is set as that switch sets it, and it is kept on the device
    assert.equal(await page.evaluate(() => { const T = window.gameTest.teach; T.setOn(true); return T.on && localStorage.getItem('kidsgame.teacherPreview'); }), '1');
    const sent = requests.length;
    const r = await page.evaluate(() => {
      const G = window.gameTest, T = G.teach, out = {}, st = () => T.state(), tap = mean => { const s = st(), i = s.replies.findIndex(x => x.mean === mean); T.reply(i); return i; };
      const answer = right => { const s = st(), q = s.talk.q, i = s.replies.findIndex(x => x.mean === 'answer' && (x.a === q.right) === right); T.reply(i); };
      G.setQuizLevels({ band: 0, math: { use: 12, best: 12, fast: false }, words: { use: 1, best: 1, fast: false } });
      G.setInv('gem', 7);
      out.opened = T.open(); out.menu = st(); out.paused = G.paused;
      T.close(); T.open(); out.menu2 = st().line;
      tap('math'); out.first = st();
      out.lesson = T.lessonsAt('math', 12).find(l => l[0] === out.first.talk.lesson);
      tap('show'); out.show = st();
      tap('why'); out.why = st();
      answer(true); out.right = st(); out.levels = G.quizLevels.math;
      tap('harder'); out.harder = st();
      answer(false); out.wrong1 = st(); answer(false); out.wrong2 = st();
      tap('easier'); out.easier = st();
      tap('another'); out.another = st();
      // keep going until he ends the talk by himself
      for (let i = 0; i < 20 && st().talk && !st().talk.ended; i++) { const s = st(); if (s.replies.some(x => x.mean === 'answer')) answer(true); else tap('another'); }
      out.end = st(); out.gems = G.inv.gem;
      tap('again'); out.again = st().line; tap('words'); out.words = st();
      out.wordOk = out.words.talk.q.answers.every(w => G.QUIZ_WORDS.some(x => x[0].toUpperCase() === w && x[2] === 1));
      out.stop = !!document.querySelector('#teachPanel [data-stop]'); document.querySelector('#teachPanel [data-stop]').click(); out.done = st(); tap('bye'); out.closed = T.state() === null && !G.paused;
      // every lesson of a row heard: they come round again (and that is recorded)
      T.setSaved({ greeted: true, right: 4, talks: 2, badges: 0, seen: { math: [], words: T.lessonsAt('words', 1).map(l => l[0]) } });
      T.open(); tap('words'); out.round = st().talk.lesson; answer(true); out.badge = st(); T.close();
      out.kept = (() => { G.saveGame(); return JSON.parse(localStorage.getItem('kidsgame.slot.0')).mirelo.teach; })();
      return out;
    });
    assert.equal(r.opened, true); assert.equal(r.paused, true, 'the game stands still while he talks');
    assert.match(r.menu.line, /^Hello, young adventurer! I can teach you now\. I am a magic helper made by a computer program, called an AI\./);
    assert.deepEqual(r.menu.replies.map(x => x.label), ["Let's talk words", "Let's talk maths", 'Goodbye']); assert.equal(r.menu.badge, true, 'the AI badge shows beside his name');
    assert.equal(r.menu2, 'Shall we talk about words or numbers?', 'the greeting is said once');
    assert.equal(r.first.talk.subject, 'math'); assert.equal(r.first.talk.level, 12);
    assert.deepEqual(r.first.replies.map(x => x.mean), ['answer', 'answer', 'answer', 'show'], 'three answers from the game and one more reply');
    assert.equal(r.first.line, r.lesson[2][0], 'he starts with the lesson'); assert.equal(r.first.flag, true); assert.equal(r.first.inputs, 0);
    assert.equal(r.show.line, r.lesson[2][1]); assert.ok(r.show.replies.some(x => x.mean === 'why'));
    assert.ok(r.why.line.length > 10 && r.why.replies.filter(x => x.mean === 'answer').length === 3);
    assert.match(r.right.line, /right|worked it out|Exactly|Yes/); assert.deepEqual(r.right.replies.map(x => x.mean), ['harder', 'another', 'done']);
    assert.equal(r.right.talk.right, 1); assert.equal(r.levels.use, 13, 'a right first answer moves the learning level');
    assert.equal(r.harder.talk.level, 13); assert.match(r.harder.line, /^A trickier one, then! /);
    assert.match(r.wrong1.line, /^Not quite\. Let us look at it together\. /); assert.equal(r.wrong1.replies.filter(x => x.mean === 'answer').length, 3);
    assert.match(r.wrong2.line, /^The answer is /, 'after two wrong tries he shows the answer'); assert.ok(!r.wrong2.replies.some(x => x.mean === 'answer'));
    assert.equal(r.easier.talk.level, 12); assert.equal(r.another.talk.kind, r.easier.talk.kind, 'another like that is the same kind of question');
    assert.equal(r.end.talk.ended, true); assert.ok(r.end.talk.replies <= 12, 'at most 12 replies: ' + r.end.talk.replies); assert.match(r.end.line, /^We solved (\d+ puzzles|a puzzle) together!$/);
    assert.deepEqual(r.end.replies.map(x => x.mean), ['again', 'bye']);
    assert.equal(r.gems, 7, 'talks give no gems');
    assert.equal(r.words.talk.q.text, 'Which word do these letters make?'); assert.equal(r.wordOk, true, 'the three words are from the game\'s list at the child\'s level');
    assert.equal(r.stop, true, 'a way to stop is always there'); assert.equal(r.done.talk.ended, true); assert.equal(r.closed, true);
    assert.match(r.round, /^w:0:\d$/); assert.match(r.badge.line, /You earned a Learning with Mirelo badge!$/);
    assert.equal(r.kept.right, 5); assert.equal(r.kept.badges, 1); assert.equal(r.kept.greeted, true);
    const out = requests.slice(sent).filter(u => !u.startsWith('http://127.0.0.1') && !/cdn\.jsdelivr\.net/.test(u) && !u.startsWith('data:') && !u.startsWith('blob:') && !/\/rest\/v1\/(game_settings|bird_facts)\?/.test(u));
    assert.deepEqual(out, [], 'a built-in talk asks nothing of any server');
    if (process.env.SHOT) { await page.evaluate(() => { const T = window.gameTest.teach; T.open(); T.reply(1); }); await page.screenshot({ path: '/tmp/ml/talk.png' }); }
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
  }, { device: PC, saves: [readyGame()] }));
