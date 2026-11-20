import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createServer, resolveFile } from '../serve-local.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-local-'));
const root = path.join(dir, 'www');
fs.mkdirSync(path.join(root, 'play'), { recursive: true });
fs.writeFileSync(path.join(root, 'play', 'index.html'), '<h1>game</h1>');
fs.writeFileSync(path.join(root, 'model.glb'), 'glb');
fs.writeFileSync(path.join(dir, 'secret.txt'), 'key');

const server = createServer(root);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
// Raw request so the path is sent exactly as written (fetch would tidy up "..").
const get = (p, method = 'GET') => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port, path: p, method }, (res) => {
    let body = ''; res.on('data', (c) => body += c); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
  });
  req.on('error', reject); req.end();
});
test.after(() => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); });

test('serves the game page from /play/ and never caches it', async () => {
  const r = await get('/play/');
  assert.equal(r.status, 200);
  assert.match(r.body, /game/);
  assert.match(r.headers['content-type'], /text\/html/);
  assert.equal(r.headers['cache-control'], 'no-store');
});
test('/play without the slash is sent to /play/', async () => {
  const r = await get('/play');
  assert.equal(r.status, 302);
  assert.equal(r.headers.location, '/play/');
});
test('3D models get the right type', async () => {
  assert.equal((await get('/model.glb')).headers['content-type'], 'model/gltf-binary');
});
test('nothing outside www can be read', async () => {
  for (const p of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%5csecret.txt', '/play/../../secret.txt', '/%2e%2e%2fsecret.txt']) {
    const r = await get(p);
    assert.notEqual(r.status, 200, p);
    assert.doesNotMatch(r.body, /key/, p);
  }
  assert.equal(resolveFile(root, '/../secret.txt')?.startsWith(root) ?? true, true);
});
test('a missing file is 404 and writing is refused', async () => {
  assert.equal((await get('/nope.js')).status, 404);
  assert.equal((await get('/play/', 'POST')).status, 405);
});
