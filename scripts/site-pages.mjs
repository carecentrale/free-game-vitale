// Builds the website's release notes page from the game's own list of changes (GAME_HISTORY in the game file,
// the same list Settings shows under "What has changed"). One source, two places, so the two cannot differ.
//   www/release-notes.html   written by this script: never edit it by hand
// Run after every new version:   node scripts/site-pages.mjs
// scripts/tests/site-pages.test.mjs fails when the page is out of date, and when the guide (www/how-to-play.html)
// does not carry the current version.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GAME_FILE = 'build/prototype-3d-v7.html';
export const NOTES_FILE = 'www/release-notes.html';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The list of versions from the game file: [{ v, title, items: [...] }], newest first
export function gameHistory(game) {
  const start = game.indexOf('const GAME_HISTORY = [');
  const end = game.indexOf('\n];', start);
  if (start < 0 || end < 0) throw new Error('GAME_HISTORY was not found in the game file');
  const list = new Function('return ' + game.slice(start + 'const GAME_HISTORY = '.length, end + 2))();
  if (!Array.isArray(list) || !list.length) throw new Error('GAME_HISTORY is empty');
  for (const h of list) {
    if (!/^\d+\.\d+\.\d+$/.test(h.v) || !h.title || !Array.isArray(h.items) || !h.items.length) throw new Error('GAME_HISTORY has an entry with a missing version, title or items: ' + JSON.stringify(h).slice(0, 80));
  }
  return list;
}

export function gameVersion(game) {
  const m = game.match(/const VERSION = '([^']+)'/);
  if (!m) throw new Error('VERSION was not found in the game file');
  return m[1];
}

// The whole release notes page
export function releaseNotesPage(list) {
  const entries = list.map(h =>
    `  <section id="v${esc(h.v)}">\n    <h2><span class="ver">${esc(h.v)}</span> ${esc(h.title)}</h2>\n    <ul>\n` +
    h.items.map(i => `      <li>${esc(i)}</li>\n`).join('') + '    </ul>\n  </section>\n').join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Release notes: Adventurers of Drenerics</title>
<meta name="description" content="What has changed in each version of Adventurers of Drenerics, newest first.">
<style>
  :root{--bg:#f4f6fb;--card:#fff;--ink:#1d2433;--muted:#5b6475;--line:#e4e7ee;--accent:#3b6fd8}
  @media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#111521;--card:#1a2030;--ink:#e8ecf5;--muted:#9aa3b5;--line:#2a3247;--accent:#6f9cf0}}
  :root[data-theme="dark"]{--bg:#111521;--card:#1a2030;--ink:#e8ecf5;--muted:#9aa3b5;--line:#2a3247;--accent:#6f9cf0}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6}
  main{max-width:760px;margin:0 auto;padding:24px 16px 48px;box-sizing:border-box}
  nav{font-size:14px;margin-bottom:12px}
  nav a{color:var(--accent);margin-right:14px}
  h1{font-size:28px;margin:8px 0 4px}
  h2{font-size:18px;margin:0 0 6px}
  p,li{font-size:16px}
  .muted{color:var(--muted);font-size:14px}
  a{color:var(--accent)}
  section{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:14px 0}
  section ul{margin:0;padding-left:20px}
  .ver{display:inline-block;background:var(--accent);color:#fff;border-radius:8px;padding:0 8px;margin-right:6px;font-size:15px}
</style>
</head>
<body>
<main>
  <nav><a href="/">Home</a><a href="/how-to-play.html">How to play</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="/contact.html">Contact</a></nav>

  <h1>Release notes</h1>
  <div class="muted">Adventurers of Drenerics. What has changed in each version, newest first. The newest version is ${esc(list[0].v)}.</div>
  <p>New to the game, or looking for how something works? Read <a href="/how-to-play.html">How to play</a>.</p>

${entries}</main>
</body>
</html>
`;
}

// ---- Run from the command line ----
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const game = fs.readFileSync(path.join(root, GAME_FILE), 'utf8');
  const list = gameHistory(game);
  fs.writeFileSync(path.join(root, NOTES_FILE), releaseNotesPage(list));
  console.log(`${NOTES_FILE}: ${list.length} versions, newest ${list[0].v}`);
}
