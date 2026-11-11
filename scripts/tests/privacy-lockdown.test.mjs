// Privacy and database-lockdown rules (0.6.56). These read the source files; they do not need a browser.
// Run from the repository root:  node --test scripts/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const game = read('build/prototype-3d-v7.html');
const admin = read('build/admin.html');
const sql = read('docs/migrations/0007_lockdown.sql');

test('the game never stores a device or player code', () => {
  assert.ok(!/localStorage\.setItem\(\s*'kidsgame\.pid'/.test(game), 'the game still saves kidsgame.pid on the device');
  assert.match(game, /localStorage\.removeItem\('kidsgame\.pid'\)/, 'the old stored code is not removed');
  assert.match(game, /const pid = Math\.random\(\)/, 'the visit code is not made fresh on each visit');
});

test('the game reaches shared worlds only through the by-code functions', () => {
  assert.ok(!/\.from\('worlds'\)/.test(game), 'the game still reads or writes the worlds table directly');
  assert.ok(!/\.from\('players'\)/.test(game), 'the game still uses the players table');
  for (const fn of ['world_get', 'world_create', 'world_save']) assert.ok(game.includes(`sb.rpc('${fn}'`), 'missing call to ' + fn);
});

test('the parent link and the stats page carry no player code', () => {
  assert.ok(!game.includes('admin.html?pid='), 'the parent link still passes a player code');
  assert.ok(!game.includes('parentPid'), 'the parent area still shows a player code');
  assert.ok(!admin.includes(".get('pid')"), 'the stats page still reads a player code from the address');
});

test('the lockdown migration closes direct access and limits log sizes', () => {
  for (const name of ['anon can read worlds', 'anon can write worlds', 'anon can update worlds', 'signed-in game can write worlds',
    'signed-in game can update worlds', 'anon can read players', 'anon can write players', 'anon can update players', 'anon can delete players']) {
    assert.ok(sql.includes(`drop policy if exists "${name}"`), 'migration does not remove: ' + name);
  }
  assert.ok(!/create policy[^;]*on public\.(worlds|players)/.test(sql), 'migration adds a direct policy on worlds or players');
  for (const fn of ['world_get', 'world_create', 'world_save']) {
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}\\([^)]*\\)[\\s\\S]*?security definer set search_path = ''`), fn + ' is not a safe function');
  }
  assert.match(sql, /char_length\(p_grid\) > 2000000/, 'world size limit missing');
  assert.equal((sql.match(/for insert to anon, authenticated\s+with check \(/g) || []).length, 3, 'the three log tables need limited insert rules');
});
