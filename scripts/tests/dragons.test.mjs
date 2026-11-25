// Dragons, every one different (0.6.94, SPEC-033): files, settings and the rule that no dragon name is shown to players.
// The flying itself is checked in the browser tests. Run:  node --test scripts/tests/dragons.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const game = read('build/prototype-3d-v7.html');
const FILES = {
  'www/models/dragons/dragon-meadow-drake.glb': 'afb4351e3bd897f4c136f0e9fb1b70532e0f6c4a081491a76f7f8025f1683898',
  'www/models/dragons/dragon-great-sky.glb': '2568061e756924148354765f2844d19d8f6f5a82d81b61e1f761b02b06cd8637',
  'www/models/dragons/dragon-long-tail-wyvern.glb': '000b5ed359a1ed00e8aca966b5a07fccd6f61ea47a71decb5173262f27d47ea1',
};

test('the three dragon files are the ones the PM delivered, each at most 600 KB and 1.8 MB in all, listed with their licence', () => {
  let total = 0;
  const assets = read('docs/ASSETS.md');
  for (const [f, sha] of Object.entries(FILES)) {
    const b = fs.readFileSync(path.join(root, f));
    assert.equal(crypto.createHash('sha256').update(b).digest('hex'), sha, f);
    assert.ok(b.length <= 600 * 1024, f + ' is ' + b.length);
    total += b.length;
    assert.ok(assets.includes(f), f + ' is not in docs/ASSETS.md');
    assert.ok(game.includes("'/" + f.slice(4) + "'"), 'the game does not use ' + f);
  }
  assert.ok(total <= 1.8 * 1024 * 1024);
  assert.ok(fs.existsSync(path.join(root, 'docs/licences/polypizza-quaternius-cc0-models-SPEC-033.txt')));
  assert.ok(fs.existsSync(path.join(root, 'docs/licences/CC0-1.0-legalcode.txt')));
});

test('no dragon name is shown to players: not in the game, the guide, the release notes or the home page', () => {
  const names = /Meadow Drake|Long-tail Wyvern|Great Sky Dragon|\bwyvern\b|\bdrake\b/i;
  for (const p of ['www/how-to-play.html', 'www/release-notes.html', 'www/index.html']) assert.doesNotMatch(read(p), names, p);
  // in the game the kinds are code words only (keys and file names), never text put on the screen
  const shown = [...game.matchAll(/say\(([^;]*)\);|textContent = ([^;]*);/g)].map(m => m[1] || m[2]).join('\n');
  assert.doesNotMatch(shown, names);
  assert.doesNotMatch(game, /Meadow Drake|Long-tail Wyvern|Great Sky Dragon/);
});

test('friendly dragons: the attack and death clips are not used except the mouth to eat; the starting weights and the owner\'s settings', () => {
  const code = game.slice(game.indexOf('// ---- Dragons that fly like real dragons'), game.indexOf('// The dragons near this child'));
  assert.doesNotMatch(code, /Death|HitReact|Punch|Dragon_Attack2|Dragon_Hit|fire/i);
  assert.match(code, /DRAGON_WEIGHT_START = \{ drake: 45, wyvern: 30, great: 15, family: 10 \}/);
  assert.match(code, /DRAGON_LEAN = 35 \* Math\.PI \/ 180, DRAGON_TIP = 25 \* Math\.PI \/ 180/);
  assert.match(game, /logOnce\('dragon_landed'/);
  const mig = read('docs/migrations/0018_dragons.sql'), admin = read('www/admin.html');
  for (const k of ['dragon_w_drake', 'dragon_w_wyvern', 'dragon_w_great', 'dragon_w_family', 'dragon_rare_pct', 'dragon_gap']) { assert.ok(mig.includes(`'${k}'`)); assert.ok(admin.includes(`data-dragon="${k}"`)); }
  assert.match(mig, /revoke all on public\.dragon_names from anon, authenticated;/);
  assert.doesNotMatch(game, /dragon_names/, 'the game never loads the names');
  // every key the table allowed before is still allowed
  const before = read('docs/migrations/0017_mirelo_settings.sql').match(/check \(key in \(([\s\S]*?)\)\);/)[1].match(/'[a-z0-9_]+'/g);
  for (const k of before) assert.ok(mig.includes(k), 'the key check lost ' + k);
});

test('SPEC-036: the landing distance is the owner\'s (3 to 30, 3 to start) for trees, rests and fish; Stay high lands nowhere; nothing is saved about fish and no block is changed', () => {
  assert.match(game, /dragonGap = Number\.isInteger\(map\.dragon_gap\) && map\.dragon_gap >= 3 && map\.dragon_gap <= 30 \? map\.dragon_gap : 3;/);
  assert.match(read('docs/migrations/0018_dragons.sql'), /key <> 'dragon_gap' or value between 3 and 30/);
  const pick = game.slice(game.indexOf('function topOpen(x, z)'), game.indexOf('function startEat(e)'));
  assert.equal((pick.match(/< dragonGap|Math\.max\(dragonGap, 4\)/g) || []).length, 2, 'rests and fish keep the landing distance');
  assert.match(game.slice(game.indexOf('function pickTree()'), game.indexOf('function topOpen(x, z)')), /< dragonGap \|\| Math\.hypot\(q\.x - x, q\.z - z\) < dragonGap/);
  assert.doesNotMatch(pick + game.slice(game.indexOf('function fishModel'), game.indexOf('function dropDragonShape')), /setBlock|writeBlock|shareBlock|saveGame|localStorage/);
  assert.match(game, /const E = dragonEat, high = dragonMode !== 'on';\n  if \(!E \|\| E\.id !== d\.id \|\| high\) return \{ \.\.\.dragonFly\(d, t\), state: 'fly' \};/);
  assert.match(game, /dragonland=\(castle\|bridge\|peak\|fish\)/);
  assert.ok(read('www/how-to-play.html').includes('Dragons also like to rest up high'));
});
