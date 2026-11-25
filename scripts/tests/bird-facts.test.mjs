// Bird facts written by AI (0.6.98, SPEC-037): the rules of the backend function, the database change and the game code.
// The card and the tap are checked in the browser tests. Run:  node --test scripts/tests/bird-facts.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KINDS, WORD_LIMITS, RULES, wordCount, withinLimits, writerRequest, checkerRequest, parseFacts, judge, run, MAX_PER_KIND } from '../../docs/functions/bird-facts/logic.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const game = read('build/prototype-3d-v7.html');
const code = game.slice(game.indexOf('// ---- Bird facts (0.6.98, SPEC-037)'), game.indexOf('// ---- The report panel: opened from Settings'));
const fn = read('docs/functions/bird-facts/index.ts'), sql = read('docs/migrations/0019_bird_facts.sql');

const good = ['Penguins slide on their bellies.', 'Penguins slide on their bellies over the snow.', 'Penguins slide on their bellies to move fast over snow and ice.',
  'Penguins often slide on their bellies, because it is faster than walking over snow and ice.', 'Penguins often toboggan, which means sliding on their bellies, because it is faster than walking on ice.'];
const yes = JSON.stringify({ true: true, safe: true, simple: true, limits: true, new: true, same: true });

test('the word limits are 10, 12, 15, 18 and 20, and are counted in code, not trusted from the AI', () => {
  assert.deepEqual(WORD_LIMITS, [10, 12, 15, 18, 20]);
  assert.equal(wordCount('  one two   three '), 3);
  assert.ok(withinLimits(good));
  assert.ok(!withinLimits(good.slice(0, 4)), 'all five versions are needed');
  assert.ok(!withinLimits(['one two three four five six seven eight nine ten eleven', ...good.slice(1)]), 'version 1 has 11 words');
  assert.ok(!withinLimits([...good.slice(0, 4), Array(21).fill('word').join(' ')]), 'version 5 has 21 words');
  assert.ok(!withinLimits(['<b>Penguins</b> slide.', ...good.slice(1)]), 'only plain text');
  assert.equal(judge([Array(11).fill('w').join(' '), ...good.slice(1)], yes).ok, false, 'over the limit is rejected even when the check says yes');
});

test('a fact is approved only with yes to every check: any no, or no answer, rejects it with the reason', () => {
  assert.deepEqual(judge(good, yes), { ok: true, reason: '' });
  for (const k of ['true', 'safe', 'simple', 'limits', 'new', 'same']) {
    const v = judge(good, JSON.stringify({ ...JSON.parse(yes), [k]: false, reason: 'because' }));
    assert.equal(v.ok, false, k); assert.match(v.reason, new RegExp('failed: ' + k));
  }
  assert.equal(judge(good, 'I think it is fine').ok, false);
  assert.equal(judge(good, '{"true":"yes","safe":true,"simple":true,"limits":true,"new":true,"same":true}').ok, false, 'only a plain true counts');
  assert.deepEqual(parseFacts('Here: [{"v":["a","b","c","d","e"]},{"x":1}]'), [['a', 'b', 'c', 'd', 'e']]);
  assert.deepEqual(parseFacts('no json'), []);
});

test('the requests to the AI carry only the bird kind, the place, the rules and pool facts: nothing about any player', () => {
  const w = writerRequest('penguin', 'snow near the sea', ['Penguins cannot fly.'], 5, 'm'), c = checkerRequest('penguin', good, ['Penguins cannot fly.'], 'm');
  for (const r of [w, c]) {
    assert.deepEqual(Object.keys(r).sort(), ['max_tokens', 'messages', 'model', 'system']);
    const text = r.system + r.messages.map(m => m.content).join('\n');
    assert.match(text, /penguin/); assert.match(text, /Penguins cannot fly\./);
    assert.doesNotMatch(text, /visit|world code|device|player|\blevel \d|name:|pid|user[_ ]?id|email/i);
  }
  for (const rule of RULES) assert.ok(w.messages[0].content.includes(rule), rule);
  assert.match(w.messages[0].content, /snow near the sea/);
  assert.match(RULES.join(' '), /hurt, killed or eaten/); assert.match(RULES.join(' '), /No people, brands, films, games, politics or religion/);
  // the function takes nothing from the caller but the bird kind, and reads only the facts table and the daily limit
  const plain = fn.replace(/\/\/.*$/gm, '');
  assert.deepEqual([...plain.matchAll(/db\.from\('([a-z_]+)'\)/g)].map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i).sort(), ['bird_facts', 'game_settings']);
  assert.deepEqual([...plain.matchAll(/body\.(\w+)/g)].map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i), ['kind']);
  assert.doesNotMatch(plain, /players|game_events|cloud_saves|reports'/);
  assert.match(plain, /data\.user\.email === OWNER/); assert.match(plain, /db\.rpc\('bird_facts_cron_ok', \{ p: cron \}\)/);
  assert.doesNotMatch(plain, /CRON_SECRET/, 'the weekly call\'s secret lives in the database\'s vault only');
  assert.doesNotMatch(fn, /sk-ant-[A-Za-z0-9]/, 'no key in the repository');
});

test('a run writes the kinds with the fewest facts first, stops at the daily limit, and a fact that fails never becomes approved', async () => {
  const saved = [], asked = [];
  const d = (limit, made, counts) => ({ counts: async () => counts, madeToday: async () => made, limit: async () => limit, pool: async () => [],
    ask: async r => { asked.push(r); return /Write \d+ new fun facts/.test(r.messages[0].content) ? JSON.stringify([{ v: good }, { v: [Array(30).fill('w').join(' '), ...good.slice(1)] }, { v: good.map(s => s.replace('slide', 'glide')) }])
      : r.messages[0].content.includes('glide') ? JSON.stringify({ ...JSON.parse(yes), true: false, reason: 'not true' }) : yes; },
    save: async row => saved.push(row) });
  const out = await run(d(4, 0, { songbird: 9, parrot: 9, owl: 9, duck: 9, penguin: 0, gull: 9, geese: 9, hawk: 9 }), 'm');
  assert.equal(saved[0].kind, 'penguin', 'fewest first');
  assert.equal(out.made, 4); assert.ok(saved.length <= 4, 'the daily limit');
  assert.deepEqual(saved.slice(0, 3).map(r => r.status), ['approved', 'rejected', 'rejected']);
  assert.match(saved[1].reason, /word limit/); assert.match(saved[2].reason, /failed: true\. not true/);
  saved.length = 0;
  assert.equal((await run(d(50, 50, {}), 'm')).made, 0, 'nothing more today');
  assert.equal((await run(d(50, 0, Object.fromEntries(Object.keys(KINDS).map(k => [k, MAX_PER_KIND]))), 'm')).made, 0, '200 a kind at most');
  assert.equal(saved.length, 0);
  assert.equal(Object.keys(KINDS).length, 8);
});

test('migration 0019: games read approved facts only, only the owner changes them, three flags hold a fact, and every earlier setting key is kept', () => {
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.bird_facts from anon, authenticated/);
  assert.match(sql, /grant select \(id, kind, v1, v2, v3, v4, v5, status\) on public\.bird_facts to anon/);
  assert.match(sql, /using \(status = 'approved' or \(auth\.jwt\(\) ->> 'email'\) = 'yammay@gmail\.com'\)/);
  assert.doesNotMatch(sql, /grant[^;]*(insert|delete)[^;]*bird_facts/i, 'no game or account adds or deletes facts: only the backend function');
  assert.match(sql, /count\(distinct reporter\)[^;]*>= 3/); assert.match(sql, /set status = 'held'/);
  assert.match(sql, /facts_per_day' or value between 1 and 200/);
  for (const prev of ['0017_mirelo_settings.sql', '0018_dragons.sql']) for (const m of read('docs/migrations/' + prev).matchAll(/'((?:mirelo|dragon)_[a-z_0-9]+)'/g)) if (!/dragon_names/.test(m[1])) assert.ok(sql.includes("'" + m[1] + "'"), m[1] + ' is still allowed');
  assert.match(read('docs/migrations/README.md'), /0019_bird_facts\.sql/);
});

test('the game: facts are only downloaded, all five versions, never one band; seen facts stay on the device; no AI is called from the game', () => {
  const plain = code.replace(/\/\/.*$/gm, '');
  assert.match(plain, /select\('id,kind,v1,v2,v3,v4,v5'\)/);
  assert.match(plain, /\.eq\('status', 'approved'\)/);
  assert.doesNotMatch(plain, /anthropic|functions\.invoke|fetch\(/i, 'the game never asks the AI');
  assert.doesNotMatch(plain, /factBand\(\)[^;]*sb\.|sb\.[^;]*factBand|sb\.[^;]*(insert|update|upsert|rpc)/, 'nothing about the child goes to the server');
  assert.doesNotMatch(plain, /sendSync|channel\./, 'the card is the child\'s own: nothing goes to other players');
  assert.match(plain, /logOnce\('animal_fact', kind \+ ' ' \+ \(f \? f\.id : 'none'\) \+ ' band' \+ birdCard\.band\)/);
  assert.match(plain, /FACT_REACH = 25, FACT_SHOW_MS = 12000, FACT_GAP_MS = 2000/);
  assert.match(plain, /Math\.max\(40, 1\.5 \* f/, 'at least 1.5 blocks around a bird');
  assert.match(plain, /esc\(f\.text\)/, 'the fact is shown as plain text');
  assert.match(plain, /aiFlagHtml\(f\.id\)/);
  assert.doesNotMatch(plain, /paused = true|<input|<textarea/, 'the game keeps running and there is nothing to type');
  assert.match(plain, /\.bcFact\{font-size:22px/, 'at least 20 px');
  assert.doesNotMatch(plain, /dragon/i, 'dragons are not tappable');
  // a press on a bird returns before digging, fighting, building or casting
  const down = game.slice(game.indexOf('pendingMerchant = merchantAt(e.clientX, e.clientY);'), game.indexOf('if (spellArmed) { pendingCast = { x: e.clientX'));
  assert.match(down, /pendingBird = birdTapAt\(e\.clientX, e\.clientY\);\s+if \(pendingBird\) return;/);
  assert.match(game, /if \(e\.button === 2 && birdTapAt\(e\.clientX, e\.clientY\)\) return;/);
});

test('the admin page has the owner\'s card: every fact with its status and reason, remove, the daily limit and "Write new facts now"', () => {
  const admin = read('www/admin.html');
  assert.equal(admin, read('build/admin.html'));
  assert.match(admin, /Bird facts \(owner only\)/);
  assert.match(admin, /functions\.invoke\('bird-facts'/);
  assert.match(admin, /status: 'removed'/);
  assert.match(admin, /data-setting="facts_per_day"|id="factsPerDay"/);
});

test('the pages say it: privacy page (Anthropic, nothing about a child), terms (text written by AI), guide and release notes', () => {
  const privacy = read('www/privacy.html'), terms = read('www/terms.html'), guide = read('www/how-to-play.html'), notes = read('www/release-notes.html');
  assert.match(privacy, /Anthropic/); assert.match(privacy, /Bird facts/);
  assert.match(terms, /Text written by AI/);
  assert.match(guide, /Tap a bird to find out a fun fact about it! Tap again for a new one: there is always more to learn\. If a fact looks wrong, tap the little flag and a grown-up will check it\./);
  assert.match(guide, /The fun facts about birds are written by AI on our server and checked by a second AI before any child sees them\. Nothing about your child is sent to the AI\. Children can flag a fact that looks wrong\./);
  assert.match(notes, /Tap a bird to learn a fun fact about it, with new facts all the time!/);
  assert.match(read('docs/EVENTS.md'), /`animal_fact`/); assert.match(read('docs/EVENTS.md'), /`bird_facts`/);
});

test('migration 0021: a weekly call that says only "run"; its secret is made in the database, kept in the vault and in no file; a run stops when its time is up', async () => {
  const m = read('docs/migrations/0021_bird_facts_weekly.sql'), plainM = m.replace(/--.*$/gm, '');
  assert.match(plainM, /cron\.schedule\('bird-facts-weekly', '0,10,20 8 \* \* 1'/);
  assert.match(plainM, /body := '\{"action":"run"\}'::jsonb/);
  assert.match(plainM, /vault\.create_secret\(replace\(gen_random_uuid\(\)::text \|\| gen_random_uuid\(\)::text, '-', ''\), 'bird_facts_cron'/);
  assert.doesNotMatch(plainM, /'[0-9a-f]{32,}'|eyJ[A-Za-z0-9_-]{20,}/, 'no secret or key is written in the file');
  assert.match(plainM, /revoke all on function public\.bird_facts_cron_ok\(text\) from public, anon, authenticated/);
  assert.match(plainM, /grant execute on function public\.bird_facts_cron_ok\(text\) to service_role/);
  assert.doesNotMatch(plainM, /player|visit|world_id/, 'nothing about a player');
  const saved = []; let asks = 0;
  const out = await run({ counts: async () => ({}), madeToday: async () => 0, limit: async () => 50, pool: async () => [], save: async r => saved.push(r), timeUp: () => asks >= 3,
    ask: async r => { asks++; return /Write \d+ new fun facts/.test(r.messages[0].content) ? JSON.stringify([{ v: good }, { v: good }, { v: good }, { v: good }, { v: good }]) : yes; } }, 'm');
  assert.ok(out.made >= 1 && out.made < 5, 'the run stopped when its time was up: ' + out.made);
});
