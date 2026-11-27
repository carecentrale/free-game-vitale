// The website's look and pages (0.6.88): SPEC-012 one look, SPEC-013 home page, SPEC-014 grouped guide,
// SPEC-015 tab icon, link previews and page-not-found, SPEC-031 Activity log, SPEC-030 share button, SPEC-032 teachers page.
// Run from the repository root:  node --test scripts/tests/site-look.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_PAGES, withSiteBlocks, withWhatsNew, withGuideLists, guideGroupProblems, guideGroups, guideParts, gameHistory, GAME_FILE, SITE } from '../site-pages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const game = read(GAME_FILE);
const css = read('www/site.css');
const SIX = ['www/index.html', 'www/how-to-play.html', 'www/release-notes.html', 'www/contact.html', 'www/privacy.html', 'www/terms.html'];
const KB = f => fs.statSync(path.join(root, f)).size / 1024;

// ---- SPEC-012: one look ----
test('every website page uses the one shared style file, and its top bar, footer and preview tags are up to date (run node scripts/site-pages.mjs)', () => {
  const list = gameHistory(game);
  for (const file of Object.keys(SITE_PAGES)) {
    const html = read(file);
    let want = withSiteBlocks(file, html);
    if (file === 'www/index.html') want = withWhatsNew(want, list);
    if (file === 'www/how-to-play.html') want = withGuideLists(want);
    assert.equal(html, want, file + ' is out of date: run node scripts/site-pages.mjs');
    assert.ok(html.includes('<link rel="stylesheet" href="/site.css">'), file + ' does not use site.css');
    assert.ok(!/<style[\s>]/.test(html), file + ' keeps its own styles');
  }
});

test('the top bar: logo and name to the home page, How to play, What is new, Contact, Play; a phone Menu that works without a script; the page you are on is marked', () => {
  const how = read('www/how-to-play.html');
  const bar = how.slice(how.indexOf('<header class="topbar">'), how.indexOf('</header>'));
  assert.ok(bar.includes('<a class="brand" href="/">') && bar.includes('Adventurers of Drenerics'));
  const order = ['href="/how-to-play.html"', 'href="/release-notes.html"', 'href="/contact.html"', 'href="/play/"'].map(h => bar.indexOf(h));
  assert.ok(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), 'top bar links out of order');
  assert.match(bar, /<details class="menu"><summary>Menu<\/summary>/);
  assert.ok(bar.includes('<a href="/how-to-play.html" aria-current="page">How to play</a>'));
  assert.ok(!read('www/privacy.html').includes('aria-current'), 'no top-bar link is marked on Privacy');
  assert.ok(!/<script/i.test(bar));
});

test('the footer on every page: How to play, What is new, Privacy, Terms, Contact and the line for players of every age', () => {
  for (const file of SIX) {
    const html = read(file), foot = html.slice(html.indexOf('<footer class="foot">'));
    for (const [h, t] of [['/how-to-play.html', 'How to play'], ['/release-notes.html', 'What is new'], ['/privacy.html', 'Privacy'], ['/terms.html', 'Terms'], ['/contact.html', 'Contact']])
      assert.ok(foot.includes(`<a href="${h}">${t}</a>`), file + ' footer misses ' + t);
    assert.ok(foot.includes('For kids, families and players of every age.'), file);
    assert.ok(!foot.includes('Store'), 'the Store link waits for SPEC-029');
  }
});

test('"What is new" everywhere: no link or heading says "Release notes", and the old addresses still work', () => {
  for (const file of Object.keys(SITE_PAGES)) {
    const html = read(file);
    assert.ok(!/<a [^>]*>\s*Release notes\s*<\/a>|<h[1-6][^>]*>\s*Release notes/i.test(html), file + ' still says Release notes');
  }
  assert.match(read('www/release-notes.html'), /<h1>What is new<\/h1>/);
  assert.ok(read('www/release-notes.html').includes('<section class="note" id="v0.6.87">'));
  assert.ok(read('www/how-to-play.html').includes('<h2 id="grownups">'));
});

test('no web fonts, no outside files, no cookies or storage on the pages, and the style file is under 20 KB', () => {
  assert.ok(KB('www/site.css') < 20, 'site.css is ' + KB('www/site.css').toFixed(1) + ' KB');
  assert.ok(!/@import|@font-face|url\(/i.test(css), 'site.css loads a file');
  for (const file of Object.keys(SITE_PAGES)) {
    const html = read(file);
    const outside = u => !u.startsWith('/') && !u.startsWith('#') && !u.startsWith('mailto:');
    // nothing is loaded from outside the site (pictures, scripts, styles, icons)
    const loads = [...html.matchAll(/<(?:img|script|link)\b[^>]*(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(outside);
    assert.deepEqual(loads, [], file + ' loads a file from outside the site');
    // no page gains a link outside the site; the terms page keeps its sound credits (licence pages), as before
    if (file !== 'www/terms.html') assert.deepEqual([...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]).filter(outside), [], file + ' links outside the site');
    assert.ok(!/document\.cookie|localStorage|sessionStorage/.test(html), file + ' uses cookies or storage');
  }
});

test('text sizes, focus outline, reduced motion, 44 px targets, and readable colours in light and dark mode', () => {
  assert.match(css, /body\{[^}]*font:18px\/1\.6/);
  assert.match(css, /@media \(max-width:600px\)\{body\{font-size:17px\}\}/);
  assert.match(css, /:focus-visible\{outline:3px solid/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /\.links a\{[^}]*min-height:44px/);
  assert.match(css, /\.foot a\{[^}]*min-height:44px/);
  // contrast of text on the page, links, buttons and the Play button, light and dark
  const long = h => h.length === 4 ? '#' + [...h.slice(1)].map(c => c + c).join('') : h;
  const vars = block => Object.fromEntries([...block.matchAll(/--([a-z-]+):(#[0-9a-f]{6}|#[0-9a-f]{3})\b/g)].map(m => [m[1], long(m[2])]));
  const light = vars(css.slice(css.indexOf(':root{'), css.indexOf('}', css.indexOf(':root{'))));
  const dark = { ...light, ...vars(css.slice(css.indexOf('@media (prefers-color-scheme:dark){:root{'), css.indexOf('}}', css.indexOf('@media (prefers-color-scheme:dark){:root{')))) };
  const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  for (const [name, v] of [['light', light], ['dark', dark]]) {
    for (const [fg, bg] of [['ink', 'bg'], ['ink', 'card'], ['muted', 'bg'], ['muted', 'card'], ['sky', 'bg'], ['sky', 'card'], ['grass-ink', 'grass'], ['gem', 'card'], ['ink', 'gem-soft'], ['ink', 'sky-soft'], ['ink', 'sun-soft']])
      assert.ok(ratio(v[fg], v[bg]) >= 4.5, `${name}: ${fg} on ${bg} is ${ratio(v[fg], v[bg]).toFixed(2)} to 1`);
  }
});

test('Privacy and Terms: the old words are all still there (only the top bar, footer and the parts added by SPEC-030 and SPEC-032 are new)', () => {
  const text = h => h.replace(/<header[\s\S]*?<\/header>|<footer[\s\S]*?<\/footer>|<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const terms = text(read('www/terms.html'));
  for (const s of ['Who can play', 'Playing fairly and safely', 'Which laws apply', 'No warranty']) assert.ok(terms.includes(s));
  const priv = text(read('www/privacy.html'));
  for (const s of ['Information the game collects', 'What we do not do', "Children's privacy", 'How to delete your data']) assert.ok(priv.includes(s));
});

// ---- SPEC-013: home page ----
test('home page: first screen with the heading, a picture and Play now; the four boxes, the learning section, parents and teachers, private worlds, teachers coming soon, what grown-ups control, What is new', () => {
  const home = read('www/index.html');
  for (const s of ['<h1>Dig, build and explore a world of blocks</h1>', 'A block-building adventure for kids, families and anyone who loves to build.',
    'Play free in your browser on tablets, phones and computers, or get the Android app. No sign-in needed.',
    '<h3>Dig and build</h3>', '<h3>Find gems and grow stronger</h3>', '<h3>Meet Vital and the quiz friends</h3>', '<h3>Play with friends</h3>',
    'Learn while playing', '<h2>Transform screen time into learning</h2>', '100 maths levels and 100 word levels', 'Levels follow your child and never go down',
    'No timers on questions, no pressure', "See your child's levels in the parent area", 'Fun at any age, with parents and teachers in control',
    'Private worlds, never public', 'Coming soon', 'For teachers and schools', 'href="/teachers.html"', 'href="/how-to-play.html#grownups">All parental controls',
    '<h2 style="margin:0">What is new</h2>', 'href="/release-notes.html">See all changes', 'Ready for an adventure?',
    'Free to play in your browser', 'Open the game and start digging. Your world is saved as you play.'])
    assert.ok(home.includes(s), 'the home page misses: ' + s);
  assert.equal((home.match(/href="\/play\/"/g) || []).length >= 3, true, 'Play now twice plus the top bar');
});

test('home page: only what is true today. No Mirelo before SPEC-028, no teachers\' own questions before the portal, no prices, purchases, store, ads or promises', () => {
  const home = read('www/index.html');
  const words = home.replace(/<!--[\s\S]*?-->/g, '');
  assert.ok(!/Mirelo/.test(words) || /Mirelo/.test(game), 'Mirelo is named before he is in the game');
  assert.ok(!words.includes("Teachers' own quiz questions"), 'teacher portal label before it opens');
  assert.ok(!/\$|price|buy|purchase|store|subscri|educational|proven|improves grades|recommended by teachers/i.test(words), 'sales or promise words');
  // the learning facts match the game
  assert.ok(game.includes('No timer and no countdown'), 'quiz questions have a timer now: change the home page');
  assert.ok(/Dragons/.test(game) && game.includes('Learning level'), 'parent area controls changed');
});

test('home page "What is new" shows the three newest versions from the game, each linking to its place on the What is new page', () => {
  const home = read('www/index.html'), list = gameHistory(game);
  const shown = [...home.matchAll(/<li><a href="\/release-notes\.html#v([\d.]+)">/g)].map(m => m[1]);
  assert.deepEqual(shown, list.slice(0, 3).map(h => h.v));
  for (const v of shown) assert.ok(read('www/release-notes.html').includes(`id="v${v}"`));
});

test('home page pictures: WebP from the game, width, height and a description; small ones under 150 KB, the big one under 250 KB, below the first screen they wait for scrolling; page under 1.3 MB', () => {
  const home = read('www/index.html');
  const imgs = [...home.matchAll(/<img class="shot" ([^>]+)>/g)].map(m => m[1]);
  assert.equal(imgs.length, 7);
  let total = KB('www/index.html') + KB('www/site.css') + KB('www/logo.png') + KB('www/icon-96.png');
  for (const a of imgs) {
    const src = a.match(/src="([^"]+)"/)[1];
    assert.match(src, /^\/home\/[a-z]+\.webp$/);
    assert.match(a, /width="\d+" height="\d+"/);
    assert.match(a, /alt="[^"]{10,}"/);
    const kb = KB('www' + src);
    total += kb;
    assert.ok(kb < (src.includes('hero') ? 250 : 150), src + ' is ' + kb.toFixed(0) + ' KB');
    if (!src.includes('hero')) assert.match(a, /loading="lazy"/);
  }
  assert.ok(total < 1300, 'home page is ' + total.toFixed(0) + ' KB');
});

// ---- SPEC-014: guide groups ----
test('every part of the guide is in exactly one of the four groups, and no group is empty', () => {
  const guide = read('www/how-to-play.html');
  assert.deepEqual(guideGroupProblems(guide), []);
  assert.deepEqual(guideGroups(guide).map(g => g.name), ['Start here', 'Things you do', 'With others', 'Settings and grown-ups']);
  assert.ok(guideGroups(guide).every(g => g.ids.length <= 15), 'a group passed 15 parts: the PM proposes a split to the owner');
});

test('a part added without a group makes the check fail; in a group it shows in the list and the phone box', () => {
  const guide = read('www/how-to-play.html');
  const withPart = guide.replace('  <p class="muted">Something in this guide', '  <section class="part">\n  <h2 id="testpart">Test part</h2><p>x</p>\n  </section>\n  <p class="muted">Something in this guide');
  assert.match(guideGroupProblems(withPart).join(), /testpart.*in no group/);
  assert.throws(() => withGuideLists(withPart));
  const grouped = withPart.replace('With others: friends, report, quiz', 'With others: friends, report, quiz, testpart');
  assert.deepEqual(guideGroupProblems(grouped), []);
  const out = withGuideLists(grouped);
  assert.equal((out.match(/<li><a href="#testpart">Test part<\/a><\/li>/g) || []).length, 2, 'in the side list and the phone box');
  assert.match(guideGroupProblems(grouped.replace('Things you do: quickbar', 'Things you do: quiz, quickbar')).join(), /in two groups/);
  assert.match(guideGroupProblems(grouped.replace('Settings and grown-ups: settings, grownups', 'Settings and grown-ups: \nOther: settings, grownups')).join(), /empty/);
});

test('the guide: a list that stays in view on a computer, "Jump to a part" on a phone, a box and "Back to top" for each part, the grown-ups part marked, two controls pictures, no script', () => {
  const guide = read('www/how-to-play.html');
  assert.match(guide, /<nav class="side" aria-label="Parts of the guide">/);
  assert.match(css, /\.guide \.side\{position:sticky/);
  assert.match(guide, /<details class="jump"><summary>Jump to a part<\/summary>/);
  const parts = guideParts(guide);
  assert.equal((guide.match(/<section class="part/g) || []).length, parts.length);
  assert.equal((guide.match(/<a class="top" href="#main">Back to top<\/a>/g) || []).length, parts.length);
  assert.match(guide, /<section class="part grown">\n  <h2 id="grownups">/);
  parts.forEach((p, i) => assert.ok(guide.includes(`<h2 id="${p.id}">${i + 1}. `), 'numbering: ' + p.id));
  for (const f of ['controls-phone', 'controls-computer']) {
    assert.ok(guide.includes(`src="/guide/${f}.webp"`));
    assert.ok(KB(`www/guide/${f}.webp`) < 150);
  }
  assert.ok(!/<script/i.test(guide));
});

test('the controls pictures name the game\'s own buttons (scripts/site-shots.mjs retakes them)', () => {
  const shots = read('scripts/site-shots.mjs');
  for (const id of ['stick', 'bJ', 'bH1', 'qb', 'bagBtn', 'teleBtn', 'powersBtn', 'mapBtn', 'settingsBtn', 'viewBtn', 'chatBtn'])
    assert.ok(game.includes(`id="${id}"`) && shots.includes(`'#${id}'`), 'button ' + id);
  assert.ok(read('CLAUDE.md').includes('scripts/site-shots.mjs'), 'CLAUDE.md release steps name the pictures script');
});

// ---- SPEC-015: icons, link previews, page not found ----
test('the six pages have the tab icon and link preview tags with their own title and description, naming only the site', () => {
  for (const file of SIX) {
    const html = read(file);
    const title = html.match(/<title>([^<]+)<\/title>/)[1];
    assert.ok(html.includes('<link rel="icon" href="/favicon.ico"') && html.includes('<link rel="apple-touch-icon" href="/apple-touch-icon.png">'), file);
    assert.ok(html.includes(`<meta property="og:title" content="${title}">`), file);
    assert.ok(html.includes(`<meta property="og:image" content="${SITE}/preview.png">`), file);
    assert.match(html, /<meta property="og:description" content="[^"]{20,}">/);
    for (const m of html.matchAll(/content="(https?:[^"]+)"/g)) assert.ok(m[1].startsWith(SITE), file + ' names ' + m[1]);
  }
  assert.ok(read('www/index.html').includes('<meta property="og:description" content="A block-building adventure for children and families. Dig, build, collect gems and explore, in your browser.">'));
  assert.ok(read('www/how-to-play.html').includes('<title>How to play: Adventurers of Drenerics</title>'));
  for (const f of ['favicon.ico', 'icon-96.png', 'icon-192.png', 'apple-touch-icon.png', 'preview.png']) assert.ok(fs.existsSync(path.join(root, 'www', f)), f);
  assert.ok(KB('www/preview.png') < 200);
  const png = fs.readFileSync(path.join(root, 'www/preview.png'));
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630]);
});

test('the page-not-found page: in the site\'s look, "This page is not here", Play now and Home, no script, kept out of search', () => {
  const nf = read('www/404.html');
  for (const s of ['<h1>This page is not here</h1>', 'The game is, though.', 'href="/play/">Play now</a>', 'href="/">Home</a>', '<meta name="robots" content="noindex">']) assert.ok(nf.includes(s), s);
  assert.ok(!/<script/i.test(nf));
});

// ---- SPEC-031: Activity log ----
test('the panel of who joined and left is called the Activity log; "chat log" is gone from the game, the guide and the notes', () => {
  assert.ok(game.includes('<div class="head"><span>Activity log</span>'));
  assert.ok(game.includes('aria-label="Activity log" title="Activity log"'));
  assert.ok(game.includes("an activity log and a map'"));
  for (const t of [game, read('www/how-to-play.html'), read('www/release-notes.html'), read('www/index.html')]) assert.ok(!/chat log/i.test(t), 'chat log');
  assert.ok(read('www/how-to-play.html').includes('The <strong>activity log</strong> at the bottom left'));
});

// ---- SPEC-030: share the game ----
test('Share the game is only inside the parent area, with fixed text and the plain home page address; no share library, no referral code', () => {
  const area = game.slice(game.indexOf("panel.id = 'parentArea';"), game.indexOf("const learnEl = document.getElementById('learnLevel');"));
  assert.ok(area.includes('<div id="shareCtl"') && area.includes('Share the game'));
  const outside = game.replace(area, '');
  assert.ok(!/Share the game|shareBtn/.test(outside.replace(/\{ v: '0\.6\.88'[\s\S]*?\] \},/, '').replace(/\/\/[^\n]*/g, '')), 'share button outside the parent area');
  assert.ok(game.includes("const SHARE_URL = 'https://free-game-vitale.vercel.app/';"));
  assert.ok(game.includes("const SHARE_TEXT = 'Adventurers of Drenerics: a block-building adventure for children and families. Play free in your browser:';"));
  assert.ok(!/referr|utm_|\?ref=/i.test(area), 'referral tracking');
  assert.ok(!/<script src=/.test(game.replace(/<script src="https:\/\/cdn\.jsdelivr[^>]+>/g, '')), 'a new script library');
});

test('the share reward is given once per saved game, kept in the save, follows the owner\'s on/off and gems, and nothing is sent as the share window opens', () => {
  assert.match(game, /dragons: dragonMode, calm: calmMotion, shared: shareGiven,/);
  assert.match(game, /shareGiven = saved\.shared === true;/);
  const give = game.slice(game.indexOf('function giveShareReward('), game.indexOf('async function openShare('));
  assert.match(give, /if \(!shareOn \|\| shareGiven \|\| activeSlot === null\) return false;/);
  assert.match(give, /addItem\('gem', shareGems\)/);
  const open = game.slice(game.indexOf('async function openShare('), game.indexOf("document.getElementById('shareCtl').addEventListener"));
  assert.ok(!/fetch\(|sb\.|sendBeacon/.test(open), 'the share window sends something');
  assert.match(game, /shareGems = Number\.isInteger\(map\.share_gems\) && map\.share_gems >= 1 && map\.share_gems <= 5000 \? map\.share_gems : 500;/);
  // the website path: the parent stats page writes the mark, the game reads its own mark only
  assert.match(game, /sb\.from\('parent_shares'\)\.select\('shared_at'\)\.eq\('user_id', cloudUser\.id\)/);
  assert.ok(read('www/admin.html').includes("sb.from('parent_shares').insert({ user_id: session.user.id })"));
  assert.ok(read('docs/migrations/0013_share_reward.sql').includes('create table if not exists public.parent_shares'));
});

// ---- SPEC-032: teachers page ----
test('the teachers page: coming soon, the four boxes, who can join, what we never ask for, the form with two tick boxes; only the site\'s own script; linked only from the home page', () => {
  const t = read('www/teachers.html');
  for (const s of ['<span class="tag">Coming soon</span>', '<h1>For teachers and schools</h1>', 'Your own quiz questions', 'A private world for each class', 'A fresh start every school year',
    'Learning that follows each child', 'Who can join', 'No student names and no class lists.', 'Want to know when it opens?', 'Send me a code',
    'I am a teacher or school staff member, 18 or older.', 'Email me when the teacher area opens, and send me news for teachers about Drenerics. I can unsubscribe at any time.'])
    assert.ok(t.includes(s), s);
  assert.deepEqual([...t.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]), ['/teachers.js']);
  for (const id of ['tName', 'tSchool', 'tCountry', 'tEmail']) assert.ok(t.includes(`id="${id}"`));
  const form = t.slice(t.indexOf('<form id="tForm"'), t.indexOf('</form>'));
  assert.deepEqual([...form.matchAll(/<label for="\w+"><b>([^<]+)<\/b>/g)].map(m => m[1]), ['Your name', 'School name', 'Country', 'School email'], 'the form asks for more');
  assert.equal((form.match(/<input|<select|<textarea/g) || []).length, 6, 'four fields and two tick boxes only');
  assert.ok(!/\$|price|Mirelo/.test(t));
  for (const f of ['www/how-to-play.html', 'www/privacy.html', 'www/contact.html']) assert.ok(!read(f).includes('href="/teachers.html"'), f + ' links the teachers page');
  assert.ok(!read('www/index.html').match(/<header[\s\S]*?<\/header>/)[0].includes('teachers'));
  assert.ok(!game.includes('teachers.html'));
});

test('the teachers form: nothing is sent until all four fields are filled and both boxes are ticked', () => {
  const window = {}, doc = { getElementById: () => ({ addEventListener() {}, querySelectorAll: () => [] }) };
  new Function('window', 'document', 'fetch', read('www/teachers.js'))(window, doc, () => { throw new Error('sent'); });
  const check = window.teacherFormCheck, ok = { name: 'A', school: 'B', country: 'CA', email: 'a@school.ca', adult: true, consent: true };
  assert.deepEqual(check(ok), []);
  assert.deepEqual(check({ ...ok, consent: false }), ['tConsent']);
  assert.deepEqual(check({ ...ok, adult: false, country: 'FR', email: 'nope' }), ['tCountry', 'tEmail', 'tAdult']);
  assert.deepEqual(check({ ...ok, name: 'x'.repeat(81) }), ['tName']);
});

test('the teacher list: owner-only tables, code kept as a hash, 15 minutes and 5 tries, 3 an hour per email and 10 per network, requests gone after 24 hours, unsubscribe deletes at once', () => {
  const sql = read('docs/migrations/0014_teacher_interest.sql'), fn = read('docs/functions/teacher-interest/index.ts');
  assert.match(sql, /revoke all on public\.teacher_interest from anon;/);
  assert.match(sql, /revoke all on public\.teacher_interest_requests from anon, authenticated;/);
  assert.match(sql, /for select to authenticated using \(\(auth\.jwt\(\) ->> 'email'\) = 'yammay@gmail\.com'\)/);
  assert.match(sql, /interval '24 hours'/);
  assert.match(fn, /code_hash: await sha256\(email \+ ':' \+ code\)/);
  assert.match(fn, /15 \* 60e3/);
  assert.match(fn, /tries >= 5/);
  assert.match(fn, /\(byEmail\.count \?\? 0\) >= 3 \|\| \(byIp\.count \?\? 0\) >= 10/);
  assert.match(fn, /delete\(\)\.eq\('unsub_token', token\)/);
  assert.match(fn, /'Your Drenerics code'/);
  assert.match(fn, /if \(!address\) throw new Error\('no mailing address'\)/);
  assert.ok(!/GMAIL_APP_PASSWORD\s*=|password:\s*'/.test(fn), 'a password in the code');
  assert.ok(read('www/privacy.html').includes('<h2 id="teachers">Teachers who ask to hear from us</h2>'));
});

// ---- Privacy page table (27 Nov 2026, found by Nick): the first column was squeezed so words broke mid-word ----
test('the privacy table keeps words whole and turns into one card per row on phones', () => {
  const page = read('www/privacy.html');
  const a = page.indexOf('<table class="stack">'), b = page.indexOf('</table>', a);
  assert.ok(a > 0, 'the privacy table should have class "stack"');
  const table = page.slice(a, b);
  assert.match(table, /<thead><tr><th>Type of information<\/th>/);
  const rows = table.match(/<tr><td>[\s\S]*?<\/tr>/g) || [];
  assert.ok(rows.length >= 10, 'privacy table rows not found');
  for (const r of rows) {
    const cells = r.match(/<td[^>]*>/g);
    assert.equal(cells.length, 5, r.slice(0, 80));
    assert.equal(cells[0], '<td>', 'the first cell stays plain (other tests find rows by it)');
    assert.deepEqual(cells.slice(1).map(c => (c.match(/data-label="([^"]+)"/) || [])[1]),
      ['What it is', 'Why we collect it', 'Where it is stored', 'Who can see it'], r.slice(0, 80));
  }
  // body allows breaking anywhere; table cells must not, or a column shrinks to one letter wide
  assert.match(css, /th,td\{overflow-wrap:break-word/);
  assert.match(css, /th:first-child,td:first-child\{min-width:9em\}/);
  assert.match(css, /\.stack td\[data-label\]::before\{content:attr\(data-label\)/);
  assert.ok(!/\.cards\s+(thead|tbody|td)/.test(css), 'the home page .cards grid must not be reused for tables');
});
