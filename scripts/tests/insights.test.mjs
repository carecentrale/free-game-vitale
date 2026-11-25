// Insights in the admin page (SPEC-040): the rules of the database functions and of the page. What the page draws is
// checked in the browser tests. Run:  node --test scripts/tests/insights.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const sql = read('docs/migrations/0020_insights.sql'), admin = read('www/admin.html');
const code = admin.slice(admin.indexOf('// ---- Insights (SPEC-040)'), admin.indexOf('// ---- Reports (0.6.91, SPEC-038)'));
const plainSql = sql.replace(/--.*$/gm, '');

test('migration 0020: both functions refuse everyone but the owner, change nothing, and cannot be run signed out', () => {
  assert.equal((plainSql.match(/if coalesce\(auth\.jwt\(\) ->> 'email', ''\) <> 'yammay@gmail\.com' then\s+raise exception 'owner only'/g) || []).length, 2);
  assert.match(plainSql, /revoke all on function public\.insights\(integer, text\) from public, anon/);
  assert.match(plainSql, /revoke all on function public\.insights_details\(integer, text, text\) from public, anon/);
  assert.doesNotMatch(plainSql, /\b(insert|update|delete|truncate|drop|alter|create table)\b/i, 'Insights deletes and changes nothing, and adds no table');
  assert.equal((plainSql.match(/\bstable\b/g) || []).length, 2);
  assert.match(plainSql, /least\(greatest\(coalesce\(p_days, 30\), 1\), 90\)/, '90 days at most');
  assert.match(read('docs/migrations/README.md'), /0020_insights\.sql/);
});

test('migration 0020: counts only. No visit code or world code is returned, and a detail needs 3 different visits', () => {
  // player_id and world_id are only counted, never selected into what is returned
  for (const m of plainSql.matchAll(/jsonb_build_object\(([^;]*?)\)\)/g)) assert.doesNotMatch(m[1], /player_id|world_id/, m[1]);
  assert.match(plainSql, /count\(distinct player_id\) as visits/);
  assert.match(plainSql, /count\(distinct player_id\) filter \(where coalesce\(world_id, ''\) <> ''\) as shared/);
  assert.match(plainSql, /having count\(distinct x\.player_id\) >= 3/);
  assert.match(plainSql, /regexp_replace\(coalesce\(detail, ''\), '\\m\[a-z0-9\]\{14,\}\\M', '', 'g'\)/, 'anything that looks like a visit code is taken out of a detail');
  assert.match(plainSql, /limit 10\) t/); assert.match(plainSql, /limit 20\) t/);
  assert.match(plainSql, /left\(regexp_replace\(message, '\[0-9\]\+', '', 'g'\), 120\)/, 'errors are grouped by the first 120 characters, numbers taken out');
  assert.doesNotMatch(plainSql.slice(plainSql.indexOf("'top_errors'"), plainSql.indexOf('end $$')), /player_id/, 'the error list has no visit code');
});

test('the page: owner only, counts from the database functions, every kind without a list in the page, charts drawn by the page', () => {
  assert.equal(admin, read('build/admin.html'));
  assert.match(admin, /<button id="openInsights">Insights<\/button>/);
  assert.match(admin, /\$\('insightsBar'\)\.classList\.toggle\('hide', session\.user\.email !== OWNER_EMAIL\)/);
  assert.match(admin, /id="insightsBar"[^>]*class="row hide"|class="row hide" id="insightsBar"/, 'hidden until the owner is signed in');
  assert.match(code, /sb\.rpc\('insights', \{ p_days: Number\(\$\('insDays'\)\.value\), p_version: \$\('insVersion'\)\.value \|\| null \}\)/);
  assert.match(code, /sb\.rpc\('insights_details'/);
  assert.doesNotMatch(code, /sb\.from\(/, 'no rows are downloaded: only counts made by the database');
  assert.doesNotMatch(code, /player_id|world_id|allEvents/, 'nothing that follows one player');
  // every kind, automatically: no record kind is named in the Insights code
  const events = read('docs/EVENTS.md');
  for (const m of events.matchAll(/^\| `([a-z_]+)` \|/gm)) assert.ok(!code.includes("'" + m[1] + "'"), 'the Insights code names the kind ' + m[1]);
  assert.doesNotMatch(code.replace(/\/\/.*$/gm, ''), /https?:|import\(|<script|<img|<canvas/i, 'no outside chart service or library');
  assert.match(code, /<svg viewBox=/);
  assert.match(admin, /<option value="7">Last 7 days<\/option><option value="30" selected>Last 30 days<\/option><option value="90">Last 90 days<\/option>/);
  assert.match(code, /Download CSV/); assert.match(code, /type: 'text\/csv'/);
  assert.match(code, /var\(--muted\)/, 'the page\'s own colours, so it reads in light and dark');
  // the cards that were there stay
  for (const t of ['Visits per day (last 14 days)', 'What people did (last 7 days)', 'Recent errors']) assert.ok(admin.includes(t), t);
  assert.match(admin, /sb\.from\('game_errors'\)\.delete\(\)/, 'Clear errors stays in the Recent errors card');
});

test('no new record kind and nothing for players: the game and the guide do not mention Insights', () => {
  assert.doesNotMatch(read('build/prototype-3d-v7.html'), /Insights|insights\(/);
  assert.doesNotMatch(read('www/how-to-play.html'), /Insights/);
  assert.match(read('CHANGELOG.md'), /Insights: charts of everything the game records, and of errors by game version\./);
});
