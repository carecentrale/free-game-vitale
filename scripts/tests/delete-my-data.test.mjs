// Delete my data (SPEC-010): the server rules. No browser and no network: the server's parts are stood in for.
// Run from the repository root:  node --test scripts/tests/delete-my-data.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle, CODE_MINUTES, MAX_TRIES } from '../../docs/functions/delete-my-data/logic.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

// A stand-in server: one parent, the code 123456, a clock the test can move
function server(over = {}) {
  const s = { time: 1000000, req: null, sent: [], deleted: 0, user: { id: 'u1', email: 'parent@example.test' }, ...over };
  s.d = {
    get user() { return s.user; },
    now: () => s.time,
    getRequest: async () => s.req && { ...s.req },
    putRequest: async r => { s.req = { ...r }; },
    dropRequest: async () => { s.req = null; },
    sendCode: async email => { s.sent.push(email); return s.sendResult || { ok: true }; },
    checkCode: async (email, code) => email === s.user.email && code === '123456',
    deleteAll: async () => { s.deleted++; return true; },
  };
  return s;
}

test('the rules are 6 digits, 15 minutes and 5 tries', () => {
  assert.equal(CODE_MINUTES, 15);
  assert.equal(MAX_TRIES, 5);
});

test('asking for a code emails the sign-in address and deletes nothing', async () => {
  const s = server();
  assert.deepEqual(await handle('request', null, s.d), { ok: true, minutes: 15 });
  assert.deepEqual(s.sent, ['parent@example.test']);
  assert.equal(s.deleted, 0);
  assert.equal(s.req.attempts, 0);
});

test('the right code deletes once; the same code does not work a second time', async () => {
  const s = server();
  await handle('request', null, s.d);
  assert.deepEqual(await handle('confirm', '123456', s.d), { ok: true, deleted: true });
  assert.equal(s.deleted, 1);
  assert.deepEqual(await handle('confirm', '123456', s.d), { error: 'no_request' });
  assert.equal(s.deleted, 1);
});

test('a code without a request deletes nothing', async () => {
  const s = server();
  assert.deepEqual(await handle('confirm', '123456', s.d), { error: 'no_request' });
  assert.equal(s.deleted, 0);
});

test('a code older than 15 minutes deletes nothing, even if it is the right one', async () => {
  const s = server();
  await handle('request', null, s.d);
  s.time += 15 * 60 * 1000 + 1;
  assert.deepEqual(await handle('confirm', '123456', s.d), { error: 'expired' });
  assert.equal(s.deleted, 0);
  assert.equal(s.req, null);
});

test('five wrong codes cancel the request; the right code afterwards deletes nothing', async () => {
  const s = server();
  await handle('request', null, s.d);
  for (let left = 4; left >= 1; left--) assert.deepEqual(await handle('confirm', '000000', s.d), { error: 'wrong', left });
  assert.deepEqual(await handle('confirm', '000000', s.d), { error: 'cancelled' });
  assert.deepEqual(await handle('confirm', '123456', s.d), { error: 'no_request' });
  assert.equal(s.deleted, 0);
});

test('a code that is not 6 digits counts as a wrong try and is never checked', async () => {
  const s = server();
  let checked = 0;
  await handle('request', null, s.d);
  const check = s.d.checkCode;
  s.d.checkCode = async (...a) => { checked++; return check(...a); };
  for (const bad of ['', '12345', '1234567', 'abcdef', null]) await handle('confirm', bad, s.d);
  assert.equal(checked, 0);
  assert.equal(s.req, null);
  assert.equal(s.deleted, 0);
});

test('nobody signed in, or an account with no email address: nothing is sent and nothing is deleted', async () => {
  for (const [user, error] of [[null, 'signed_out'], [{ id: 'u1', email: '' }, 'no_email']]) {
    const s = server({ user });
    assert.deepEqual(await handle('request', null, s.d), { error });
    assert.deepEqual(await handle('confirm', '123456', s.d), { error });
    assert.equal(s.sent.length + s.deleted, 0);
  }
});

test('when the email cannot be sent, no request is kept', async () => {
  const s = server({ sendResult: { wait: true } });
  assert.deepEqual(await handle('request', null, s.d), { error: 'wait' });
  assert.equal(s.req, null);
});

test('the two new tables are closed to the game and to signed-in parents, and the log keeps a date only', () => {
  const sql = read('docs/migrations/0009_delete_my_data.sql');
  for (const t of ['deletion_requests', 'deletion_log']) {
    assert.ok(sql.includes(`alter table public.${t} enable row level security`));
    assert.ok(sql.includes(`revoke all on public.${t} from anon, authenticated`));
  }
  assert.ok(!/create policy/.test(sql), 'no direct access rule may be added');
  const log = sql.slice(sql.indexOf('public.deletion_log ('), sql.indexOf('alter table public.deletion_log'));
  assert.deepEqual([...log.matchAll(/^\s+(\w+) /gm)].map(m => m[1]), ['id', 'deleted_on']);
  assert.ok(!/code|token/.test(sql.slice(sql.indexOf('create table'))), 'the code itself is never stored');
});

test('the server function sends the email through the existing sign-in service and never creates an account', () => {
  const fn = read('docs/functions/delete-my-data/index.ts');
  assert.ok(fn.includes('shouldCreateUser: false'));
  assert.equal([...fn.matchAll(/from '([^']+)'/g)].map(m => m[1]).join(), 'npm:@supabase/supabase-js@2,./logic.mjs');
});

// ---- The game, the website page, the guide and the privacy page (0.6.70) ----
const game = read('build/prototype-3d-v7.html');
const page = read('www/delete-my-data.html');
const guide = read('www/how-to-play.html');
const privacy = read('www/privacy.html');

test('in the game, nothing on the device is deleted except at the last step', () => {
  const block = game.slice(game.indexOf('// ---- Delete my data (0.6.92'), game.indexOf('// Finish digging the block'));
  assert.equal((block.match(/dmdWipeDevice\(\)/g) || []).length, 3, 'the device is wiped in exactly two places (plus the function itself)');
  assert.match(block, /if \(dmd\.signedIn\) return dmdAskCode\(\);\s+dmdWipeDevice\(\);/, 'a signed-in parent must go to the code step, never straight to deleting');
  assert.match(block, /if \(r\.ok && r\.deleted\) \{[\s\S]{0,200}?dmdWipeDevice\(\);/, 'with a parent signed in, the device is wiped only after the server says the data is deleted');
  assert.ok(!/type="email"/.test(block), 'the game must never ask for an email address here');
  assert.ok(!/user\.email|\.email\b/.test(block), 'the game must not show or read the email address here');
});

test('the website page has the same three confirmations and the emailed code, and never creates an account', () => {
  for (const id of ['want', 'hold', 'word', 'wordGo', 'code2', 'codeGo']) assert.ok(page.includes(`id="${id}"`), 'missing on the page: ' + id);
  assert.match(page, /HOLD_MS = 3000, CODE_MS = 15 \* 60 \* 1000/);
  assert.ok(page.includes("value.trim() === 'DELETE'"));
  assert.ok(page.includes('shouldCreateUser: false') && !page.includes('shouldCreateUser: true'));
  assert.ok(page.includes("functions.invoke('delete-my-data'"));
  assert.ok(page.includes('persistSession: false'), 'the page must not keep a sign-in on the computer');
  const out = [...page.matchAll(/href="([^"]+)"/g)].map(m => m[1]).filter(u => !u.startsWith('/') && u !== '#main');
  assert.deepEqual(out, [], 'the page links outside the site');
});

test('the guide and the release notes carry the texts from SPEC-010', () => {
  assert.ok(guide.includes('<strong>Delete my data</strong>, above Quit. This one is for grown-ups: it removes everything the game holds.'));
  assert.ok(guide.includes('The game shows what will be removed and asks you three times. If you are signed in, it then emails a 6-digit code to your sign-in address; type it within 15 minutes.'));
  assert.ok(guide.includes('href="/delete-my-data.html"'));
  const notes = read('www/release-notes.html');
  assert.ok(notes.includes('New in Settings: Delete my data. A grown-up can remove everything the game holds. It asks three times and sends a code by email first'));
  for (const p of ['www/index.html', 'www/release-notes.html', 'www/privacy.html', 'www/terms.html']) assert.ok(!/Teacher Approved|approved by teachers/i.test(read(p)), p + ' must not claim the badge');
});

test('the privacy page points to the Delete my data page and no longer says in-app deletion is still to come', () => {
  const part = privacy.slice(privacy.indexOf('<h2 id="delete">'));
  assert.ok(part.includes('href="/delete-my-data.html"'));
  assert.ok(!privacy.includes('In-app deletion will be added'));
  for (const words of ['15 minutes', 'date only', 'backups within 30 days', 'Shared worlds'.toLowerCase()]) assert.ok(part.toLowerCase().includes(words.toLowerCase()), 'the privacy page does not say: ' + words);
});
