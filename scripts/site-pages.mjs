// Builds the website's release notes page ("What is new") from the game's own list of changes (GAME_HISTORY in the game file,
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

// ---- One look for the whole website (SPEC-012) and link previews (SPEC-015) ----
// Every website page carries three blocks written by this script, so the top bar, the footer and the preview tags
// live in one place: <!-- site-head --> ... <!-- /site-head -->, <!-- site-header --> ... and <!-- site-footer --> ...
// scripts/tests/site-look.test.mjs fails when a page's blocks are out of date: run node scripts/site-pages.mjs.
export const SITE = 'https://free-game-vitale.vercel.app';
// The home page's Google Play badge shows only once the game is public on Google Play (SPEC-013). Internal testing: false.
export const PLAY_PUBLIC = false;
// address of each page, and which top-bar link it marks (null: none)
export const SITE_PAGES = {
  'www/index.html': { path: '/', current: null },
  'www/how-to-play.html': { path: '/how-to-play.html', current: 'how' },
  'www/release-notes.html': { path: '/release-notes.html', current: 'new' },
  'www/contact.html': { path: '/contact.html', current: 'contact' },
  'www/privacy.html': { path: '/privacy.html', current: null },
  'www/terms.html': { path: '/terms.html', current: null },
  'www/teachers.html': { path: '/teachers.html', current: null },
  'www/404.html': { path: '/404.html', current: null, noPreview: true },
};
export const TOP_LINKS = [['how', '/how-to-play.html', 'How to play'], ['new', '/release-notes.html', 'What is new'], ['contact', '/contact.html', 'Contact']];
// The footer line: "Made for children and families." until SPEC-013, then this (SPEC-013, owner 23 Nov 2026)
export const FOOTER_LINE = 'For kids, families and players of every age.';
export const FOOTER_LINKS = [['/how-to-play.html', 'How to play'], ['/release-notes.html', 'What is new'], ['/privacy.html', 'Privacy'], ['/terms.html', 'Terms'], ['/contact.html', 'Contact']];

export function siteHeader(current) {
  const links = TOP_LINKS.map(([k, href, label]) => `<li><a href="${href}"${k === current ? ' aria-current="page"' : ''}>${label}</a></li>`).join('');
  return `<a class="skip" href="#main">Skip to the page</a>
<header class="topbar"><div class="in">
  <a class="brand" href="/"><img src="/icon-96.png" alt="" width="44" height="44"><span>Adventurers of Drenerics</span></a>
  <nav class="desk" aria-label="Site"><ul class="links">${links}</ul></nav>
  <details class="menu"><summary>Menu</summary><nav aria-label="Site"><ul class="links">${links}</ul></nav></details>
  <a class="btn btn-play" href="/play/">Play</a>
</div></header>`;
}

export function siteFooter() {
  return `<footer class="foot"><div class="in">
  <ul>${FOOTER_LINKS.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join('')}</ul>
  <p>${FOOTER_LINE}</p>
</div></footer>`;
}

// Tab icon and link preview tags. They only describe the page: they load nothing and name only the site's own address.
export function siteHead(page, html) {
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || 'Adventurers of Drenerics';
  const desc = (html.match(/<meta name="description" content="([^"]*)">/) || [])[1] || '';
  const icons = `<link rel="stylesheet" href="/site.css">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" type="image/png" href="/icon-96.png" sizes="96x96">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">`;
  if (page.noPreview) return icons + '\n<meta name="robots" content="noindex">';
  return icons + `
<meta property="og:type" content="website">
<meta property="og:site_name" content="Adventurers of Drenerics">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${SITE}${page.path}">
<meta property="og:image" content="${SITE}/preview.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="The Adventurers of Drenerics logo: a floating block island with a castle">
<meta name="twitter:card" content="summary_large_image">`;
}

const block = (html, name, body) => {
  const a = `<!-- ${name} -->`, b = `<!-- /${name} -->`;
  const i = html.indexOf(a), j = html.indexOf(b);
  if (i < 0 || j < i) throw new Error('missing ' + a);
  return html.slice(0, i + a.length) + '\n' + body + '\n' + html.slice(j);
};
// A page with its three blocks brought up to date
export function withSiteBlocks(file, html) {
  const page = SITE_PAGES[file];
  if (!page) throw new Error('not a website page: ' + file);
  html = block(html, 'site-head', siteHead(page, html));
  html = block(html, 'site-header', siteHeader(page.current));
  return block(html, 'site-footer', siteFooter());
}

// The three newest versions, for the home page's "What is new" (SPEC-013). Written between
// <!-- whats-new --> and <!-- /whats-new --> from the same list as the release notes, so the two cannot differ.
export function whatsNewList(list) {
  return '<ul class="news">' + list.slice(0, 3).map(h =>
    `<li><a href="/release-notes.html#v${esc(h.v)}"><span class="ver">${esc(h.v)}</span> <b>${esc(h.title)}</b></a></li>`).join('') + '</ul>';
}
export function withWhatsNew(html, list) { return block(html, 'whats-new', whatsNewList(list)); }

// ---- The guide's groups (SPEC-014) ----
// The groups live in one place in www/how-to-play.html, in the comment <!-- guide-groups ... -->, one line each:
// "Group name: id, id, id". This script makes the list on the left and the phone's "Jump to a part" box from it.
export function guideGroups(guide) {
  const m = guide.match(/<!-- guide-groups\n([\s\S]*?)-->/);
  if (!m) throw new Error('the guide has no <!-- guide-groups --> block');
  return m[1].split('\n').filter(l => /^[A-Z][^:]*: /.test(l)).map(l => {
    const [name, ids] = l.split(': ');
    return { name: name.trim(), ids: ids.split(',').map(x => x.trim()).filter(Boolean) };
  });
}
// Every part of the guide: [{ id, title }] in page order, title without its number
export function guideParts(guide) {
  return [...guide.matchAll(/<h2 id="([a-z-]+)">(?:\d+\. )?([^<]*)<\/h2>/g)].map(m => ({ id: m[1], title: m[2] }));
}
// Problems with the groups: a part in no group or in two, a group that is empty, an id with no part
export function guideGroupProblems(guide) {
  const groups = guideGroups(guide), parts = guideParts(guide), problems = [];
  const seen = new Map();
  for (const g of groups) {
    if (!g.ids.length) problems.push('the group "' + g.name + '" is empty');
    for (const id of g.ids) {
      if (seen.has(id)) problems.push('the part "' + id + '" is in two groups: ' + seen.get(id) + ' and ' + g.name);
      seen.set(id, g.name);
      if (!parts.some(p => p.id === id)) problems.push('the group "' + g.name + '" names a part that is not on the page: ' + id);
    }
  }
  for (const p of parts) if (!seen.has(p.id)) problems.push('the part "' + p.id + '" (' + p.title + ') is in no group');
  return problems;
}
function guideListHtml(guide) {
  const titles = Object.fromEntries(guideParts(guide).map(p => [p.id, p.title]));
  return guideGroups(guide).map(g => `<h2>${esc(g.name)}</h2><ol>` +
    g.ids.map(id => `<li><a href="#${id}">${esc(titles[id] || id)}</a></li>`).join('') + '</ol>').join('\n');
}
// The guide with its numbers, side list and phone box brought up to date
export function withGuideLists(guide) {
  const problems = guideGroupProblems(guide);
  if (problems.length) throw new Error('guide groups: ' + problems.join('; '));
  let n = 0;
  guide = guide.replace(/<h2 id="([a-z-]+)">(?:\d+\. )?/g, (_, id) => `<h2 id="${id}">${++n}. `);
  const list = guideListHtml(guide);
  guide = block(guide, 'guide-list', `<nav class="side" aria-label="Parts of the guide">\n${list}\n</nav>`);
  return block(guide, 'guide-jump', `<details class="jump"><summary>Jump to a part</summary><div>\n${list}\n</div></details>`);
}

// The whole release notes page ("What is new" everywhere, owner 23 Nov 2026; the address stays /release-notes.html)
export function releaseNotesPage(list) {
  const entries = list.map(h =>
    `  <section class="note" id="v${esc(h.v)}">\n    <h2><span class="ver">${esc(h.v)}</span> ${esc(h.title)}</h2>\n    <ul>\n` +
    h.items.map(i => `      <li>${esc(i)}</li>\n`).join('') + '    </ul>\n  </section>\n').join('');
  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>What is new: Adventurers of Drenerics</title>
<meta name="description" content="What has changed in each version of Adventurers of Drenerics, newest first.">
<!-- site-head -->
<!-- /site-head -->
</head>
<body>
<!-- site-header -->
<!-- /site-header -->
<main id="main" class="page">
  <h1>What is new</h1>
  <div class="muted">Adventurers of Drenerics. What has changed in each version, newest first. The newest version is ${esc(list[0].v)}.</div>
  <p>New to the game, or looking for how something works? Read <a href="/how-to-play.html">How to play</a>.</p>

${entries}</main>
<!-- site-footer -->
<!-- /site-footer -->
</body>
</html>
`;
  return withSiteBlocks(NOTES_FILE, page);
}

// ---- Run from the command line ----
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const game = fs.readFileSync(path.join(root, GAME_FILE), 'utf8');
  const list = gameHistory(game);
  fs.writeFileSync(path.join(root, NOTES_FILE), releaseNotesPage(list));
  console.log(`${NOTES_FILE}: ${list.length} versions, newest ${list[0].v}`);
  for (const file of Object.keys(SITE_PAGES)) {
    if (file === NOTES_FILE) continue;
    const p = path.join(root, file);
    if (!fs.existsSync(p)) { console.log(file + ': missing'); continue; }
    let html = withSiteBlocks(file, fs.readFileSync(p, 'utf8'));
    if (file === 'www/index.html') html = withWhatsNew(html, list);
    if (file === 'www/how-to-play.html') html = withGuideLists(html);
    fs.writeFileSync(p, html);
    console.log(file + ': top bar, footer and preview tags written');
  }
}
