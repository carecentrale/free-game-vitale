// Takes the website's pictures of the game (SPEC-013 home page, SPEC-014 controls pictures) from the current game,
// in a local browser with no internet, so they never fall behind the game. A tool for releases, not part of the site.
//   CHROME_PATH=/usr/bin/google-chrome node scripts/site-shots.mjs            all pictures
//   CHROME_PATH=/usr/bin/google-chrome node scripts/site-shots.mjs controls   only the two controls pictures
// Writes WebP files to www/home/ and www/guide/ (needs Python with Pillow for the WebP step).
// The pictures use a test game with made-up numbers and a name from the game's own list: never a real child's game,
// and no world code. The owner looks at every picture before the home page goes live.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv[2] || '';
const tmp = fs.mkdtempSync('/tmp/shots-');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const SUPABASE_STUB = `const h = { get: (t, p) => p === 'then' ? (r) => r({ data: { session: null, user: null }, error: null }) : P, apply: () => P };
const P = new Proxy(function () {}, h); export const createClient = () => P;`;
const CENTER = 200000;

function serve() {
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

// A made-up test game: a name from the game's own list, made-up quiz numbers. Its world is not shared, so no code shows
let SPOT = [CENTER + 0.5, 40, CENTER + 0.5];
function testGame() {
  return JSON.stringify({
    v: 1, at: Date.now(), name: 'Kestrel', profile: { sex: 'boy', race: 'human', name: 'Kestrel' }, worldId: 'SHOTWORLD',
    inv: { dirt: 6, stone: 4, gem: 3, pick: 1, sword: 1 }, qb: ['pick', 'sword', 'dirt', 'stone', null, null],
    recent: ['pick', 'sword', 'dirt', 'stone'], sel: 0,
    pw: { dig: { lvl: 4, xp: 0 }, build: { lvl: 3, xp: 0 }, inv: { lvl: 6, xp: 0 }, fight: { lvl: 3, xp: 0 } },
    pos: SPOT, yaw: 0.6,
    world: { v: 2, seed: 4242, edits: [] }, drops: [], skills: ['fireball'],
    quiz: { math: { opened: 46, first: 31, later: 9, hints: 3, swaps: 1 }, words: { opened: 28, first: 17, later: 7, hints: 2, swaps: 1 }, since: '2026-11-02', last: '2026-11-22' },
    levels: { band: 0, math: { use: 17, best: 17 }, words: { use: 9, best: 9 } },
  });
}

async function openGame(browser, base, device) {
  const page = await browser.newPage(device);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await page.route(/cdn\.jsdelivr\.net\/npm\/three@0\.160\.0\//, r => {
    const local = path.join(root, 'node_modules', 'three', new URL(r.request().url()).pathname.replace('/npm/three@0.160.0/', ''));
    return fs.existsSync(local) ? r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(local) }) : r.fulfill({ status: 404, body: '' });
  });
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: SUPABASE_STUB }));
  await page.route(/\/rest\/v1\/game_settings/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.addInitScript(save => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('kidsgame.quiz', '0');
    localStorage.setItem('kidsgame.vital', JSON.stringify({ on: false }));
    localStorage.setItem('kidsgame.slot.0', save);
    sessionStorage.setItem('kidsgame.choice', '0');
    sessionStorage.setItem('seeded', '1');
  }, testGame());
  await page.goto(base + '/play/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.gameTest && typeof window.gameTest.stepFrames === 'function', null, { timeout: 120000 });
  await page.waitForTimeout(4000);
  return page;
}
const settle = async (page, n = 220) => { await page.evaluate(n => window.gameTest.stepFrames(Array(n).fill(1 / 30)), n); await page.waitForTimeout(2500); };
async function shot(page, name, clip) {
  const png = path.join(tmp, name + '.png');
  await page.screenshot({ path: png, ...(clip ? { clip } : {}) });
  return png;
}
// PNG to WebP at a width, under a size limit
function webp(png, out, width, maxKB) {
  const py = `
import sys
from PIL import Image
src, out, w, kb = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
im = Image.open(src).convert('RGB')
im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
for q in (82, 75, 68, 60, 52, 45):
    im.save(out, 'WEBP', quality=q, method=6)
    import os
    if os.path.getsize(out) <= kb * 1024: break
print(out, im.size, os.path.getsize(out) // 1024, 'KB')
`;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  process.stdout.write(execFileSync('python3', ['-c', py, png, out, String(width), String(maxKB)]).toString());
}
// Names the buttons on a controls picture: a label beside each on-screen control that is showing
async function labelControls(page, labels) {
  await page.evaluate(labels => {
    const layer = document.createElement('div');
    layer.id = 'shotLabels';
    layer.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;font:700 14px system-ui,sans-serif';
    for (const [sel, text, side] of labels) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden') continue;
      const tag = document.createElement('div');
      tag.textContent = text;
      tag.style.cssText = 'position:absolute;background:#f5c542;color:#2a1f00;border:2px solid #2a1f00;border-radius:8px;padding:2px 8px;white-space:nowrap';
      const x = side === 'left' ? r.left - 8 : side === 'right' ? r.right + 8 : r.left + r.width / 2;
      const y = side === 'below' ? r.bottom + 8 : side === 'below2' ? r.bottom + 40 : side === 'above' ? r.top - 30 : r.top + r.height / 2 - 12;
      tag.style.left = x + 'px'; tag.style.top = y + 'px';
      tag.style.transform = side === 'left' ? 'translateX(-100%)' : side === 'right' ? '' : 'translateX(-50%)';
      layer.append(tag);
      el.style.outline = '3px solid #f5c542';
    }
    document.body.append(layer);
  }, labels);
}
// The labels on the controls pictures: they name the game's own buttons, so a renamed button shows up here
const CONTROL_LABELS = [
  ['#stick', 'Thumb stick: walk', 'right'], ['#bJ', 'Jump', 'left'], ['#bH1', 'Hand button', 'left'],
  ['#qb', 'Quick bar', 'above'], ['#bagBtn', 'Bag', 'below'], ['#teleBtn', 'Teleport', 'below'], ['#powersBtn', 'Powers', 'below2'],
  ['#mapBtn', 'Map', 'below'], ['#settingsBtn', 'Settings', 'below2'], ['#viewBtn', 'Change view', 'below'], ['#chatBtn', 'Activity log', 'right'],
];

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
// A green place to stand: the nearest spot in the test world where forest reaches 30 blocks all round
async function findSpot() {
  // 1: the nearest place where forest reaches 30 blocks all round (biomes are known everywhere at once)
  let page = await openGame(browser, base, { viewport: { width: 400, height: 300 } });
  const f = await page.evaluate(C => {
    const g = window.gameTest, ok = (x, z) => [[0, 0], [30, 0], [-30, 0], [0, 30], [0, -30]].every(([a, b]) => g.biomeAt(x + a, z + b) === 'forest');
    for (let r = 0; r <= 4000; r += 40) for (let a = 0; a < 360; a += r ? Math.max(3, 2400 / r) : 360) {
      const x = Math.round(C + r * Math.cos(a * Math.PI / 180)), z = Math.round(C + r * Math.sin(a * Math.PI / 180));
      if (ok(x, z)) return [x, z];
    }
    return null;
  }, CENTER);
  await page.close();
  if (f) SPOT = [f[0] + 0.5, 62, f[1] + 0.5];
  // 2: standing there (so its land is made), the nearest dry grass with no water close by
  page = await openGame(browser, base, { viewport: { width: 400, height: 300 } });
  await page.waitForTimeout(3000);
  const xz = await page.evaluate(([cx, cz]) => {
    const g = window.gameTest, T = g.T, C = cx;
    const top = (x, z) => { for (let y = 120; y > 0; y--) { const t = g.cellAt(x, y, z); if (t !== T.AIR && t !== undefined) return t; } return null; };
    const dry = (x, z) => [[0, 0], [12, 0], [-12, 0], [0, 12], [0, -12], [24, 24], [-24, -24], [24, -24], [-24, 24]].every(([a, b]) => top(x + a, z + b) === T.GRASS);
    const ok = (x, z) => [[0, 0], [30, 0], [-30, 0], [0, 30], [0, -30]].every(([a, b]) => g.biomeAt(x + a, z + b) === 'forest');
    for (let r = 0; r <= 600; r += 8) for (let a = 0; a < 360; a += r ? Math.max(3, 600 / r) : 360) {
      const x = Math.round(cx + r * Math.cos(a * Math.PI / 180)), z = Math.round(cz + r * Math.sin(a * Math.PI / 180));
      if (ok(x, z) && dry(x, z)) return [x, z];
    }
    return null;
  }, [SPOT[0] - 0.5, SPOT[2] - 0.5]);
  await page.close();
  if (xz) SPOT = [xz[0] + 0.5, 62, xz[1] + 0.5];
  console.log('standing at', SPOT.join(', '));
}
try {
  await findSpot();
  if (!only || only === 'controls') {
    const pc = await openGame(browser, base, { viewport: { width: 1200, height: 750 } });
    await settle(pc);
    await labelControls(pc, CONTROL_LABELS);
    webp(await shot(pc, 'controls-computer'), path.join(root, 'www/guide/controls-computer.webp'), 1200, 150);
    await pc.close();
    const phone = await openGame(browser, base, { viewport: { width: 780, height: 360 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await settle(phone);
    await labelControls(phone, CONTROL_LABELS);
    webp(await shot(phone, 'controls-phone'), path.join(root, 'www/guide/controls-phone.webp'), 1200, 150);
    await phone.close();
  }
  if (!only || only === 'home') {
    const page = await openGame(browser, base, { viewport: { width: 1200, height: 750 } });
    await page.evaluate(() => { const s = document.getElementById('pad'); if (s) s.style.display = 'none'; });
    await settle(page, 60);
    webp(await shot(page, 'hero'), path.join(root, 'www/home/hero.webp'), 1200, 250);
    // Dig and build: a hole dug to the right of the player and a small wall built to the left, the way a player would
    await page.evaluate(() => {
      const g = window.gameTest, W = innerWidth, H = innerHeight;
      const hole = g.sightAt(W * 0.62, H * 0.66), wall = g.sightAt(W * 0.36, H * 0.6);
      if (hole) { const [x, y, z] = hole.map(Math.floor); for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let d = 0; d < 1; d++) g.digCell(x + a - 1, y - d, z + b - 1); }
      if (wall) { const [x, y, z] = wall.map(Math.floor); for (let a = 0; a < 4; a++) for (let h = 1; h <= 3; h++) g.placeCell(x + a - 2, y + h, z, h === 3 ? 'stone' : 'dirt'); }
    });
    await settle(page, 30);
    await page.evaluate(() => { document.getElementById('msg').textContent = ''; });
    webp(await shot(page, 'dig'), path.join(root, 'www/home/dig.webp'), 640, 150);
    await page.evaluate(() => document.getElementById('powersBtn').click());
    await page.waitForTimeout(1500);
    // No world code on the website: hide the panel's "World ..." line
    await page.evaluate(() => { for (const el of document.querySelectorAll('#powers *')) if (!el.children.length && /^World /.test(el.textContent.trim())) el.style.visibility = 'hidden'; });
    webp(await shot(page, 'gems'), path.join(root, 'www/home/gems.webp'), 640, 150);
    await page.evaluate(() => document.getElementById('powersBtn').click());
    await page.evaluate(() => { window.gameTest.callFriend('add'); });
    await settle(page, 90);
    webp(await shot(page, 'friends'), path.join(root, 'www/home/friends.webp'), 640, 150);
    await page.evaluate(() => { window.gameTest.askKind('add'); window.gameTest.openQuiz(); });
    await page.waitForTimeout(1500);
    webp(await shot(page, 'quiz'), path.join(root, 'www/home/quiz.webp'), 900, 150);
    await page.evaluate(() => { window.gameTest.quizNotNow(); window.gameTest.removeFriend(); window.gameTest.toggleMap(true); });
    await settle(page, 10);
    webp(await shot(page, 'together'), path.join(root, 'www/home/together.webp'), 640, 150);
    await page.evaluate(() => window.gameTest.toggleMap(false));
    // The parent area, opened the way a grown-up does: five quick taps in the top-left corner
    await page.evaluate(() => { const t = [...document.body.children].find(e => e.style.width === '70px' && e.style.height === '70px'); for (let i = 0; i < 5; i++) t.click(); });
    await page.waitForTimeout(1500);
    // Only the learning level and the learning report (made-up numbers from the test game), side by side
    await page.evaluate(() => {
      const box = document.querySelector('#parentArea > div');
      for (const el of box.children) if (!['learnLevel', 'quizReport'].includes(el.id)) el.style.display = 'none';
      box.style.maxWidth = '760px'; box.style.display = 'grid'; box.style.gridTemplateColumns = '1fr 1fr'; box.style.gap = '18px';
      box.scrollTop = 0;
    });
    await page.waitForTimeout(800);
    webp(await shot(page, 'report'), path.join(root, 'www/home/report.webp'), 900, 150);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
