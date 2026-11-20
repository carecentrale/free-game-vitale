// Local test server for Adventurers of Drenerics.
// Serves the game folder's www directory (read only) to this PC and to devices on the same network,
// so the game can be played before anything is pushed to GitHub.
//   node serve-local.mjs [path-to-www] [port]
// Not part of the game: lives in the build tools folder. No packages needed.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.m4a': 'audio/mp4', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
};

// Turns a request path into a file inside root, or null when it would leave root.
export function resolveFile(root, urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split('?')[0].split('#')[0]); } catch { return null; }
  if (p.includes('\0')) return null;
  const file = path.resolve(root, '.' + path.posix.normalize('/' + p.replace(/\\/g, '/')));
  const rel = path.relative(root, file);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return file;
}

export function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}

export function createServer(root) {
  root = path.resolve(root);
  return http.createServer((req, res) => {
    const send = (code, text) => { res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(text); };
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'Read only');
    let file = resolveFile(root, req.url || '/');
    if (!file) return send(403, 'Not allowed');
    fs.stat(file, (err, st) => {
      if (!err && st.isDirectory()) {
        const clean = (req.url || '/').split('?')[0];
        if (!clean.endsWith('/')) { res.writeHead(302, { Location: clean + '/' }); return res.end(); }
        file = path.join(file, 'index.html');
        return fs.stat(file, (e2, st2) => (e2 || !st2.isFile()) ? send(404, 'Not found') : pipe(file, st2));
      }
      if (err || !st.isFile()) return send(404, 'Not found');
      pipe(file, st);
    });
    function pipe(f, st) {
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream',
        'Content-Length': st.size,
        'Cache-Control': 'no-store', // always the latest files: this is for testing
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(f).on('error', () => res.destroy()).pipe(res);
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] || path.join(os.homedir(), 'Desktop', 'adventurers-of-drenerics-game', 'www'));
  const port = Number(process.argv[3]) || 8080;
  if (!fs.existsSync(path.join(root, 'play', 'index.html'))) {
    console.error('Cannot find the game at ' + root + ' (no play\\index.html there).');
    process.exit(1);
  }
  const server = createServer(root);
  server.on('error', (e) => {
    console.error(e.code === 'EADDRINUSE' ? 'Port ' + port + ' is already in use. Is the test server already running?' : String(e));
    process.exit(1);
  });
  server.listen(port, '0.0.0.0', () => {
    console.log('Local test server for Adventurers of Drenerics');
    console.log('Serving (read only): ' + root);
    console.log('');
    console.log('On this PC:        http://localhost:' + port + '/play/');
    for (const a of lanAddresses()) console.log('On the same Wi-Fi: http://' + a + ':' + port + '/play/');
    console.log('');
    console.log('Close this window to stop the server.');
  });
}
