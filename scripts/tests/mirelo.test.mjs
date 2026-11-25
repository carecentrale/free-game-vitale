// Mirelo, the wandering mage (0.6.93, SPEC-028): his lines, his rules and his settings. No browser.
// Run from the repository root:  node --test scripts/tests/mirelo.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const game = read('build/prototype-3d-v7.html');
const start = game.indexOf('// ---- Mirelo, the wandering mage (0.6.93'), end = game.indexOf('// ---- Teacher Mirelo: talks from lessons built into the game (0.6.103', start);
assert.ok(start > 0 && end > start, 'Mirelo code markers not found');
const code = game.slice(start, end), plain = code.replace(/\/\/.*$/gm, '');
const M = vm.runInContext(code.slice(0, code.indexOf('const MIRELO_KEY')) + '\n;({ MIRELO_LINES, MIRELO_TIPS, MIRELO_DEFAULTS, mireloSet, setMireloTimes })', vm.createContext({ Number }));

test('the twelve tips and the lesson lines are the spec\'s', () => {
  assert.equal(M.MIRELO_TIPS.length, 12);
  assert.equal(M.MIRELO_TIPS[0], 'Fire fizzles in water, so keep your fireballs dry!');
  assert.equal(M.MIRELO_TIPS[11], 'Lost? You can always teleport back to the start.');
  assert.equal(M.MIRELO_LINES.hello, 'Hello, young adventurer! I am Mirelo. I sense magic in you. Watch!');
  assert.equal(M.MIRELO_LINES.try, 'Now you try! Tap the Spell button, then tap the target.');
  assert.equal(M.MIRELO_LINES.done, 'Wonderful! Fireball is yours. Remember: fire fizzles in water!');
  assert.equal(M.MIRELO_LINES.found, 'I see you found your magic!');
  assert.equal(M.MIRELO_LINES.knows, 'I see you already know Fireball! Here is a secret:');
});

test('no line Mirelo says mentions buying, upgrading, prices or the parent area', () => {
  // every piece of text in his code: his lines, his tips, his buttons and his messages
  const texts = [...Object.values(M.MIRELO_LINES), ...M.MIRELO_TIPS, ...[...plain.matchAll(/'([^'\n]{12,})'|>([^<>{}$\n]{3,})</g)].map(m => m[1] || m[2])];
  assert.ok(texts.length > 25);
  for (const t of texts) assert.doesNotMatch(t, /\bbuy|purchas|upgrad|price|\bpay|\$|gems? for|parent|grown-up|smarter|premium|pass\b|subscri|unlock more/i, t);
});

test('fixed text only: nothing is sent, logged or fetched when he talks or teaches', () => {
  for (const word of ['logEvent', 'logOnce', 'fetch(', 'XMLHttpRequest', 'sendBeacon', 'sb.', 'channel', 'playerName', '<input', '<textarea'])
    assert.ok(!plain.includes(word), 'the Mirelo code uses ' + word);
});

test('the owner\'s timings: starting values, ranges, and out-of-range values fall back', () => {
  assert.deepEqual({ ...M.MIRELO_DEFAULTS }, { visit: 15, stay: 3, away: 24, unlock: 5, retry: 2 });
  M.setMireloTimes({ mirelo_visit_min: 30, mirelo_stay_min: 5, mirelo_away_hours: 48, mirelo_unlock_min: 10, mirelo_retry_min: 4 });
  assert.deepEqual({ ...M.mireloSet }, { visit: 30, stay: 5, away: 48, unlock: 10, retry: 4 });
  M.setMireloTimes({ mirelo_visit_min: 0, mirelo_stay_min: 11, mirelo_away_hours: 169, mirelo_unlock_min: 2.5, mirelo_retry_min: 'x' });
  assert.deepEqual({ ...M.mireloSet }, { visit: 15, stay: 3, away: 24, unlock: 5, retry: 2 });
  const mig = read('docs/migrations/0017_mirelo_settings.sql');
  for (const k of ['mirelo_visit_min', 'mirelo_stay_min', 'mirelo_away_hours', 'mirelo_unlock_min', 'mirelo_retry_min']) { assert.ok(mig.includes(`'${k}'`)); assert.ok(read('www/admin.html').includes(`data-mirelo="${k}"`)); }
  assert.match(mig, /mirelo_visit_min' or value between 1 and 120/);
  // every key the table allowed before is still allowed
  const before = read('docs/migrations/0015_reports.sql').match(/check \(key in \(([\s\S]*?)\)\);/)[1].match(/'[a-z0-9_]+'/g);
  for (const k of before) assert.ok(mig.includes(k), 'the key check lost ' + k);
});

test('the rules in the code: never stuck, away for the owner\'s hours, Vital first, the lesson target is not a block', () => {
  assert.match(code, /mir\.nots >= 2 \|\| mireloRun\.sinceL2 >= mireloSet\.unlock \* 60/);
  assert.match(code, /mir\.away = Date\.now\(\) \+ mireloSet\.away \* 3600000/);
  assert.match(code, /Date\.now\(\) < mir\.away/);
  assert.ok(!/setBlock|writeBlock|shareBlock|inv\[|gems/.test(plain), 'the lesson places a real block or gives something');
  const upd = game.slice(game.indexOf('function updateFriend(dt)'), game.indexOf('function friendAt('));
  assert.ok(upd.indexOf("spawnFriend('vital')") < upd.indexOf("spawnFriend('mirelo')") && upd.indexOf("spawnFriend('mirelo')") < upd.indexOf('if (!quizOn) return;'), 'Vital goes first, then Mirelo, then the quiz friends');
  assert.match(upd, /!anyPanelOpen\(\) && !monsterNear\(FRIEND_MONSTER_CLEAR\) && mireloDue\(dt\)/);
  assert.ok(game.includes('mirelo: mir,'), 'kept in the saved game');
  assert.ok(game.includes('id="mireloSwitch"'));
  const guide = read('www/how-to-play.html');
  assert.ok(guide.includes('<h2 id="mirelo">3. Mirelo, the wandering mage</h2>'));
  assert.ok(guide.includes('Mirelo the wandering mage comes to teach you your first spell, the Fireball.'));
});
