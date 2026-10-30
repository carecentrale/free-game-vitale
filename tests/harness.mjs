// Test harness: serves www/ locally, launches headless Chromium, and answers CDN requests
// from node_modules so the game can run without internet access.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const WWW = path.join(root, 'www');
const MODULES = path.join(here, 'node_modules');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.css': 'text/css' };

export async function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(WWW, urlPath === '/' ? 'index.html' : urlPath);
    if (!file.startsWith(WWW) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

// Map CDN URLs to local files. Anything else that is not this server gets blocked.
function localFor(url) {
  const three = url.match(/^https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.160\.0\/(.+)$/);
  if (three) return path.join(MODULES, 'three', three[1].split('?')[0]);
  return null;
}

export async function launch() {
  const executablePath = await chromium.executablePath();
  return puppeteer.launch({ executablePath, args: chromium.args, headless: true, defaultViewport: { width: 480, height: 360 } });
}

export async function openGame(browser, baseUrl, { storage = null } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.setRequestInterception(true);
  page.on('request', req => {
    const url = req.url();
    if (url.startsWith(baseUrl)) return req.continue();
    const local = localFor(url);
    if (local && fs.existsSync(local)) {
      const type = TYPES[path.extname(local)] || 'text/javascript';
      return req.respond({ status: 200, contentType: type, body: fs.readFileSync(local) });
    }
    return req.abort(); // no internet in tests: block everything else
  });
  if (storage) {
    await page.evaluateOnNewDocument(s => { localStorage.setItem('kidsgame.save.v1', s); }, JSON.stringify(storage));
  }
  await page.goto(baseUrl, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 1500)); // let the first frames run
  return { page, errors };
}

// A flat test world (same size as the game's): stone below, one grass layer at y = 11.
// The character stands on top of it at x = 20, z = 20, so blocks are always within reach.
export const WORLD = { W: 40, H: 24, D: 40 };
export function flatWorldB64() {
  const { W, H, D } = WORLD;
  const grid = new Uint8Array(W * H * D); // 0 = air
  const idx = (x, y, z) => (y * D + z) * W + x;
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    for (let y = 0; y < 11; y++) grid[idx(x, y, z)] = 3; // stone
    grid[idx(x, 11, z)] = 1; // grass
  }
  let s = '';
  for (let i = 0; i < grid.length; i++) s += String.fromCharCode(grid[i]);
  return Buffer.from(s, 'binary').toString('base64');
}
export const STAND = [20.5, 12, 20.5];
