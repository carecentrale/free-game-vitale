// Believable monsters (0.6.96, SPEC-035): the model files, their licence records and the rules in the code.
// The animations are checked in the browser tests. Run:  node --test scripts/tests/monsters.test.mjs
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
  'brute-yeti': '9266bb96ccb5d76a6b06b8578a14ab119cb2a9a34586d2d0f89b34036aa40963', 'brute-orc': 'f12d56e62bc3cd8b0e1b7ca0ac6fc81630124efeab50a55782f5582e1f3d6a15',
  'brute-blue-demon': '3fd03e03605f26f53a185d3f28276235b786a51ce2a41e3b93f0c97bc6edc32a', 'brute-big-arm': '4b892c178f118ce716a47440d84db88200d39073c2a23801f75d82a007211993',
  'goblin-orc-enemy': 'f48382f31f9abba3302b74b4d4a50d6104ec0d280649778426a3ae6146e66b6b', 'goblin-tribal': 'ba5562e875dbaa115b931a7f2cdf6f329b029673c48799a242f008133db55879',
  'hood-goblin-ninja': 'e9b3712dd852dc30ed7e5b8a34d2ccec37d0b6334db6d7e6329e19aa977d309d', 'hood-goblin-ninja-2': 'cfa8382243ae8fff4d2957980902c989bef988bc933e6364e4c3a24b9846eb9c',
  'spear-imp-demon-2': '2425b1383642eede54b806280cf267a7baf0eea2a18216e24142f19b9b21b736', 'spear-imp-demon': 'f84fb0b2be352ee8251990b0e37840be3d462bd393a19e2c2eb749a25188a688',
  'imp-spike-beast-moves': 'befb709d9ff119a5194bd9bea3ae12b8abe924bc5919ea870a9f848c39ff1ef6',
};

test('the monster files are the ones the PM delivered: each at most 600 KB (Imp 800 KB), 4.5 MB in all, each listed with its licence', () => {
  const assets = read('docs/ASSETS.md');
  let total = fs.statSync(path.join(root, 'www/models/imp.glb')).size + fs.statSync(path.join(root, 'www/models/puglin.glb')).size;
  assert.ok(fs.statSync(path.join(root, 'www/models/imp.glb')).size <= 800 * 1024);
  for (const [name, sha] of Object.entries(FILES)) {
    const f = 'www/models/monsters/' + name + '.glb', b = fs.readFileSync(path.join(root, f));
    assert.equal(crypto.createHash('sha256').update(b).digest('hex'), sha, f);
    assert.ok(b.length <= 600 * 1024, f);
    total += b.length;
    assert.ok(assets.includes(f), f + ' is not in docs/ASSETS.md');
    assert.ok(game.includes("'" + name + "'") || game.includes(name + '.glb'), 'the game does not use ' + name);
  }
  assert.ok(total <= 4.5 * 1024 * 1024, 'all monster files: ' + total);
  for (const f of ['polypizza-quaternius-cc0-models-SPEC-035.txt', 'polypizza-quaternius-big-arm-cc-by-3.0.txt', 'quaternius-universal-animation-library.txt', 'CC-BY-3.0-legalcode.txt'])
    assert.ok(fs.existsSync(path.join(root, 'docs/licences', f)), f);
  // the one model that needs a credit has it in Settings and on the terms page
  assert.match(game, /id="modelCredit"[^>]*>[^<]*&quot;Big arm&quot; by Quaternius[^<]*CC BY 3\.0/);
  assert.match(read('www/terms.html'), /id="model-credit">[^<]*&quot;Big arm&quot; by Quaternius/);
});

test('the looks of each kind, and the fight numbers unchanged', () => {
  const kinds = game.slice(game.indexOf('const ENEMY_KINDS = {'), game.indexOf('// Damage to an enemy'));
  assert.match(kinds, /brute:[^\n]*looks: \['brute-yeti', 'brute-orc', 'brute-blue-demon', 'brute-big-arm'\]/);
  assert.match(kinds, /goblin:[^\n]*looks: \['goblin-orc-enemy', 'goblin-tribal'\]/);
  assert.match(kinds, /hood:[^\n]*looks: \['hood-goblin-ninja', 'hood-goblin-ninja-2'\]/);
  assert.match(kinds, /spear:[^\n]*looks: \['spear-imp-demon-2', 'spear-imp-demon'\]/);
  assert.match(kinds, /imp:[^\n]*file: '\/models\/imp\.glb', height: 1\.1, moves: true/);
  assert.match(kinds, /spike:[^\n]*file: '\/models\/puglin\.glb', height: 0\.9, moves: true/);
  // health, toughness, weakness and gems as in 0.6.88
  for (const [k, n] of [['goblin', 'power: 1, health: 3,  toughness: 0'], ['imp', 'power: 2, health: 4,  toughness: 0'], ['brute', 'power: 4, health: 9,  toughness: 2'], ['spear', 'power: 3, health: 6,  toughness: 1'], ['hood', 'power: 3, health: 6,  toughness: 1'], ['spike', 'power: 3, health: 8,  toughness: 3']])
    assert.ok(kinds.includes(k + ':') && kinds.includes(n), k);
  // heights: Brute about 1.75 blocks (1.3 x 1.35), Imp about 0.94 as before (1.1 x 0.85)
  assert.match(kinds, /brute:[^\n]*scale: 1\.35[^\n]*height: 1\.3/);
});

test('the rules in the code: blend of 0.2 seconds, the walk played at the speed it moves, no attack toward the child, the look from the monster\'s own number', () => {
  const code = game.slice(game.indexOf('// ---- Believable monsters (0.6.96'), game.indexOf('let enemySpawnT'));
  assert.match(code, /crossFadeTo\(A\[want\], 0\.2, false\)/);
  assert.match(code, /A\.walk\.timeScale = Math\.max\(0\.4, Math\.min\(3, speed \* A\.walkDur \/ A\.stride\)\)/);
  assert.match(code, /function monsterLook\(kind, id\)/);
  assert.doesNotMatch(code, /Bite_Front|Sword_Attack|Punch_Cross|Run_Attack|Weapon'/, 'an attack clip is used');
  assert.match(game, /en\.turning = Math\.abs\(off - step\) > 0\.26;/);   // it walks only once it faces the way (15 degrees)
  assert.ok(read('www/how-to-play.html').includes('Every monster has its own way of moving.'));
});
