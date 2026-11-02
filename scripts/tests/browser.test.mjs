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
