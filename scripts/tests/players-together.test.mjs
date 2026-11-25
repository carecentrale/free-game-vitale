// 0.6.87: not starting inside the ground when joining a world, notes when players come and go, the player count and the map.
// The code is copied out of the game file at test time, so the tests run the real code, not a copy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const game = fs.readFileSync(path.join(root, 'build', 'prototype-3d-v7.html'), 'utf8');

function between(a, b) {
  const s = game.indexOf(a), e = game.indexOf(b, s);
  if (s < 0 || e < 0) throw new Error('markers not found: ' + a);
  return game.slice(s, e);
}
const T = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, GEM: 4, WATER: 5, SAND: 6, SNOW: 7, CSTONE: 8, ROOF: 9, WOOD: 10, ROOFB: 11,
  PALE: 12, SANDST: 13, DARK: 14, SLATE: 15, WINDOW: 16, IRON: 17, COBBLE: 18, EARTH: 19 };

function helpers() {
  const code = between('// ---- Players together (0.6.87)', '// ---- end of players-together helpers');
  const ctx = vm.createContext({ T, SURF: 12, titles: ['Lord', 'Mistress', 'Sir', 'Dame'], names: ['Kestrel', 'Elowen', 'Brannoc', 'Aldric'], Map, Math, RegExp });
  return vm.runInContext(code + '; ({ safeName, presenceNotes, mapColor, mapSpot, MAP_COLORS })', ctx);
}

// A small world for placeSafely: ground (stone) up to height `ground` everywhere, plus extra blocks
function placeCtx(ground, extra = new Set()) {
  const H = 96;
  const get = (x, y, z) => (y <= ground || extra.has(x + ',' + y + ',' + z)) ? T.STONE : T.AIR;
  const solid = t => t !== T.AIR && t !== T.WATER;
  const HW = 0.3, FOOT = 0.05, HH = 1.7;
  const hits = (x, y, z) => {
    for (const dx of [-HW, HW]) for (const dz of [-HW, HW]) for (const dy of [FOOT, HH - FOOT]) if (solid(get(Math.floor(x + dx), Math.floor(y + dy), Math.floor(z + dz)))) return true;
    return false;
  };
  const ctx = vm.createContext({ H, get, solid, hits, Math, topSpawnPoint: () => [1000.5, ground + 3.01, 1000.5], logged: [], px: 0, py: 0, pz: 0, vx: 1, vy: 1, vz: 1 });
  const s = game.indexOf('function placeSafely(fresh)');
  const e = game.indexOf('const spawnPoint = topSpawnPoint;', s);
  vm.runInContext('function logEvent(k, d) { logged.push(k + \' \' + d); }\n' + game.slice(s, e), ctx);
  return ctx;
}

test('0.6.87: a child who joins a world from the start screen begins at that world\'s start point, never where the new-game world had put them', () => {
  const c = placeCtx(30);
  Object.assign(c, { px: 5.5, py: 10, pz: 5.5 });   // deep inside the joined world's hill
  assert.equal(vm.runInContext('placeSafely(true)', c), 'start');
  assert.deepEqual([c.px, c.py, c.pz], [1000.5, 33.01, 1000.5]);
  assert.deepEqual([c.vx, c.vy, c.vz], [0, 0, 0]);
  assert.deepEqual([...c.logged], ['spawn_moved start join'], 'the move is recorded');
  // and the game really does it: the wizard joins with fresh = true, and every load of the land checks the place
  assert.match(game, /joinExisting\(wiz\.code, true\)/);
  assert.match(between('async function joinExisting', 'async function createWorld'), /placeSafely\(fresh\)/);
  assert.match(game, /loadShared\(data\.grid, worldId\); dirty = true; placeSafely\(false\);/);
});

test('0.6.87: reopening a shared world keeps the child where they were, or lifts them onto the land when blocks are in the way', () => {
  const c = placeCtx(20);
  Object.assign(c, { px: 5.5, py: 21.01, pz: 5.5 });   // standing on the ground: stays
  assert.equal(vm.runInContext('placeSafely(false)', c), 'ok');
  assert.equal(c.py, 21.01);
  Object.assign(c, { px: 5.5, py: 15, pz: 5.5 });      // inside the ground: up onto it, same place
  assert.equal(vm.runInContext('placeSafely(false)', c), 'up');
  assert.deepEqual([c.px, c.py, c.pz], [5.5, 21.01, 5.5]);
  assert.equal(c.hits(c.px, c.py, c.pz), false);
  assert.deepEqual([...c.logged], ['spawn_moved up reload'], 'only real moves are recorded');
  // someone built a pillar right up to the sky here: the start point instead
  const sky = new Set(); for (let y = 0; y < 96; y++) sky.add('5,' + y + ',5');
  const d = placeCtx(20, sky);
  Object.assign(d, { px: 5.5, py: 15, pz: 5.5 });
  assert.equal(vm.runInContext('placeSafely(false)', d), 'start');
});

test('0.6.87: only names the game makes are shown for other players; anything else shows as "A player"', () => {
  const { safeName } = helpers();
  for (const n of ['Sir Kestrel 1', 'Dame Elowen 999', 'Lord Aldric 42', 'Mistress Brannoc 7']) assert.equal(safeName(n), n);
  for (const n of ['hello', 'Sir Kestrel', 'Sir Kestrel 0', 'Sir Kestrel 1000', 'Sir Bob 5', 'Sir Kestrel 5 call me', '<b>Sir Kestrel 5</b>', '', null, 5, undefined])
    assert.equal(safeName(n), 'A player', String(n));
  // the name tag over a player's head and the list of players use it too
  assert.match(game, /nameTag\(safeName\(meta\.name\)\)/);
  assert.match(game, /name: safeName\(m\.name\)/);
});

test('0.6.87: a note says who is here on arrival, who joins and who leaves', () => {
  const { presenceNotes } = helpers();
  const M = o => new Map(Object.entries(o));
  assert.deepEqual([...presenceNotes(M({}), M({}), true)], []);
  assert.deepEqual([...presenceNotes(M({}), M({ a: 'Sir Kestrel 1' }), true)], ['Sir Kestrel 1 is here']);
  assert.deepEqual([...presenceNotes(M({}), M({ a: 'A', b: 'B', c: 'C', d: 'D' }), true)], ['4 friends are here: A, B, C and more']);
  assert.deepEqual([...presenceNotes(M({ a: 'A' }), M({ a: 'A', b: 'Dame Elowen 3' }), false)], ['Dame Elowen 3 joined your world']);
  assert.deepEqual([...presenceNotes(M({ a: 'A', b: 'B' }), M({ b: 'B' }), false)], ['A left the world']);
  assert.deepEqual([...presenceNotes(M({ a: 'A' }), M({ a: 'A' }), false)], [], 'nothing changed: no note');
  // the log (0.6.87) shows text only (never HTML), keeps the last 50 notes for this visit only (not saved or sent)
  const log = between("// ---- The world's log (0.6.87)", 'const playersInWorld');
  assert.doesNotMatch(log, /innerHTML|localStorage|sendSync|channel\.send|logEvent/);
  assert.match(log, /const LOG_MAX = 50;/);
  assert.match(log, /while \(worldLog\.length > LOG_MAX\) worldLog\.shift\(\)/);
  assert.match(log, /document\.createTextNode\(e\.text \+ /);
  assert.match(game, /else if \(logOpen\) toggleLog\(false\);/, 'Esc closes the log');
});

test('0.6.87: the player count shows at the top left in a shared world', () => {
  assert.match(game, /worldId \? ` &nbsp; Players \$\{playersInWorld\(\)\}` : ''/);
  assert.match(game, /const playersInWorld = \(\) => worldId \? 1 \+ others\.size : 1;/);
});

test('0.6.87: the map has a colour for every block, and players off the map are drawn on its edge', () => {
  const { mapColor, mapSpot, MAP_COLORS } = helpers();
  for (let t = 1; t <= 19; t++) assert.ok(MAP_COLORS[t], 'colour for block ' + t);
  for (const y of [0, 12, 50, 95]) for (const v of mapColor(T.GRASS, y)) assert.ok(v >= 0 && v <= 255);
  assert.ok(mapColor(T.GRASS, 40)[1] > mapColor(T.GRASS, 5)[1], 'higher land is lighter');
  assert.deepEqual({ ...mapSpot(100, 100, 100, 100, 48, 384) }, { sx: 192, sy: 192, edge: false });
  const far = mapSpot(1000, 100, 100, 100, 48, 384);
  assert.equal(far.edge, true); assert.equal(far.sx, 384); assert.equal(far.sy, 192);
  // M opens and closes it (not while typing a world code), the Map button too, and Escape closes it
  assert.match(game, /e\.code === 'KeyM' && !e\.repeat && !\(e\.target && e\.target\.tagName === 'INPUT'\)\) toggleMap\(\)/);
  assert.match(game, /getElementById\('mapBtn'\)\.addEventListener\('click', \(\) => toggleMap\(\)\)/);
  assert.match(game, /if \(mapOpen\) toggleMap\(false\);/);
  // the map reads only land already loaded: it never makes new land just to draw it
  assert.match(between('function drawMapLand', 'function drawMapDots'), /chunks\.has\(/);
});

test('0.6.89: hints go into the Activity log, not across the top of the screen', () => {
  assert.doesNotMatch(game, /id="msg"|#msg\{|msgEl/, 'no message line at the top of the screen any more');
  assert.match(game, /if \(logReady\) addNote\(text, \{ hint: true, ms \}\); else sayQueue\.push\(\[text, ms\]\);/, 'say() writes to the log');
  assert.match(game, /for \(const \[t, m\] of sayQueue\.splice\(0\)\) addNote\(t, \{ hint: true, ms: m \}\);/, 'hints said before the log is ready are not lost');
  assert.match(game, /if \(!logOpen && !hint\) logUnread\+\+;/, 'hints do not raise the red count');
  assert.match(game, /last\.text === text && now - last\.at < NOTE_SAME_MS/, 'the same hint again adds to the last line');
});

// ---- Playing together, safely (0.6.90, SPEC-039): the words on the pages and the records ----
test('SPEC-039: terms speak to parents, guide and privacy say parent portal, the new records are listed, no Facebook button shown', () => {
  const read = f => fs.readFileSync(path.join(root, f), 'utf8');
  const terms = read('www/terms.html'), guide = read('www/how-to-play.html'), privacy = read('www/privacy.html'), events = read('docs/EVENTS.md');
  assert.match(terms, /A parent or guardian accepts them for their child\. Children are not asked to agree to anything\./);
  assert.doesNotMatch(terms, /By playing, you agree/);
  assert.match(terms, /<h2>Playing together in shared worlds<\/h2>/);
  assert.doesNotMatch(terms, /Last updated: 18 November 2026/);
  assert.match(guide, /<td>Parent portal<\/td>/); assert.match(guide, /Tap <em>Open parent portal<\/em>/);
  assert.match(guide, /<td>Playing together<\/td>/); assert.match(guide, /read the Playing together card/);
  assert.doesNotMatch(guide + privacy, /parent stats page|Open parent stats|Sign in with Facebook/);
  assert.match(game, />Open parent portal<\/a>/);
  assert.match(game, /\$c\('cloudFacebook'\)\.style\.display = 'none'/);
  for (const k of ['together_switch', 'safety_reminder']) { assert.match(events, new RegExp('`' + k + '`')); assert.match(game, new RegExp("logEvent\\('" + k + "'")); }
  // the loading screen lines and the card's lines are the spec's five lines
  for (const l of ['Only play with friends and family you know.', 'Keep your world code for friends and family.', 'If something looks wrong, tap Report.', 'If something upsets you, tell a grown-up.'])
    assert.ok(game.split(l).length >= 3, 'on the loading screen and the card: ' + l);
  assert.match(game, /TOGETHER_CARD_MS = 4000/);
  assert.match(game, /if \(togetherCardOpen\) return;/);
});

// ---- Report (0.6.91, SPEC-038): what a report holds, and that a device cannot read the reports ----
test('SPEC-038: the game only adds reports through report_add with the allowed fields; devices cannot read reports; only the owner reads and acts', () => {
  const mig = fs.readFileSync(path.join(root, 'docs', 'migrations', '0015_reports.sql'), 'utf8');
  assert.match(mig, /revoke all on public\.reports from anon, authenticated;/);
  assert.match(mig, /create policy "owner reads reports" on public\.reports\s+for select to authenticated using \(\(auth\.jwt\(\) ->> 'email'\) = 'yammay@gmail\.com'\)/);
  assert.doesNotMatch(mig, /grant [^;]*insert[^;]* on public\.reports/, 'no direct insert: only through report_add');
  assert.match(mig, /interval '10 minutes'\) >= 5/, 'at most 5 in 10 minutes on the server too');
  for (const t of ['mp_stops', 'world_restores']) assert.match(mig, new RegExp('revoke all on public\\.' + t + ' from anon, authenticated;'));
  // the columns hold no name and nothing typed
  const cols = mig.slice(mig.indexOf('create table if not exists public.reports'), mig.indexOf(');', mig.indexOf('create table if not exists public.reports')));
  assert.doesNotMatch(cols, /\bname\b|\btext_typed\b|picture|image|email/);
  // the game never reads the reports table and sends only these fields
  assert.doesNotMatch(game, /sb\.from\('reports'\)/);
  const send = game.slice(game.indexOf('function sendReport(r)'), game.indexOf('// ---- AI lines'));
  const keys = [...new Set([...send.matchAll(/\b(p_[a-z_]+)\b/g)].map(m => m[1]))].sort();
  assert.deepEqual(keys, ['p_ai_line', 'p_category', 'p_changed', 'p_kind', 'p_look', 'p_player', 'p_reporter', 'p_world', 'p_x', 'p_y', 'p_z']);
  assert.doesNotMatch(send, /playerName|\.name\b(?!\))/, 'no name is sent');
});
