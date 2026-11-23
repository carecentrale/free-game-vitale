// Tracking records (Nick's rule, 23 Nov 2026): everything the game sends off the device is listed in docs/EVENTS.md,
// and every row there names a row of the privacy page (www/privacy.html) that exists.
// A row whose privacy column starts with "Not yet" is a known gap waiting for Nick's decision: listed as todo, not failed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const game = read('build/prototype-3d-v7.html');
const events = read('docs/EVENTS.md');
const privacy = read('www/privacy.html').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'");

const all = (re, s = game) => [...new Set([...s.matchAll(re)].map(m => m[1]))].sort();
const listed = name => events.includes('`' + name + '`');

// What the game sends, read from the code
const sent = {
  'gameplay record kinds (logEvent, logOnce)': all(/log(?:Event|Once)\('([a-z_]+)'/g),
  'enemy debug log kinds (debugLog)': all(/debugLog\('([a-z_]+)'/g),
  'database tables': all(/sb\.from\('([a-z_]+)'\)/g).concat(all(/\/rest\/v1\/([a-z_]+)\?/g)),
  'database functions': all(/sb\.rpc\('([a-z_]+)'/g),
  'shared-world messages': all(/sendSync\('([a-z]+)'/g).concat(all(/channel\.send\(\{ type: 'broadcast', event: '([a-z]+)'/g)),
};
// The presence fields: the keys of the object myMeta() returns
{
  const body = game.slice(game.indexOf('function myMeta()'));
  const ret = body.slice(body.indexOf('return {') + 8, body.indexOf('};', body.indexOf('return {')));
  sent['shared-world presence fields'] = [...new Set([...ret.matchAll(/(?:^|,)\s*([a-zA-Z_]+)\s*(?=[:,]|$)/g)].map(m => m[1]))].sort();
}
if (/capacitor-app-update|AppUpdate/.test(game)) sent['other requests'] = ['google_play_update_check'];

test('the game code sends records of every kind this test looks for (the patterns still match the code)', () => {
  for (const [what, names] of Object.entries(sent)) assert.ok(names.length > 0, 'found nothing for ' + what);
  assert.ok(sent['shared-world presence fields'].includes('name'), 'presence fields not read: ' + sent['shared-world presence fields']);
});

for (const [what, names] of Object.entries(sent)) {
  test(`every ${what} the game sends is listed in docs/EVENTS.md`, () => {
    const missing = names.filter(n => !listed(n));
    assert.deepEqual(missing, [], `add these to docs/EVENTS.md (and the privacy page): ${missing.join(', ')}`);
  });
}

test('records are never sent with a typed name, chat or anything typed', () => {
  // logEvent details come from game words: none of the calls passes the player's name
  for (const m of game.matchAll(/log(?:Event|Once)\(([^;]*)\);/g)) assert.doesNotMatch(m[1], /playerName|\.name\b|input|value/, 'logEvent(' + m[1] + ')');
  assert.doesNotMatch(game, /type="text"|<textarea/i, 'a text box would let a child type');
});

// Every table row of docs/EVENTS.md: a backticked name in the first column, the privacy-page row in the last
const rows = events.split('\n').filter(l => /^\| `[^`]+` \|/.test(l)).map(l => {
  const cells = l.split('|').slice(1, -1).map(c => c.trim());
  return { name: cells[0].replace(/`/g, ''), privacy: cells[cells.length - 1] };
});

test('docs/EVENTS.md has rows to check', () => assert.ok(rows.length >= 30, 'rows found: ' + rows.length));

for (const r of rows) {
  if (/^Not yet/.test(r.privacy)) {
    test(`privacy page: "${r.name}" waits for Nick's decision`, { todo: r.privacy }, () => {});
    continue;
  }
  if (/^Not needed/.test(r.privacy)) continue;
  test(`privacy page has the row named for "${r.name}"`, () => {
    const title = (r.privacy.match(/"([^"]+)"/) || [])[1];
    assert.ok(title, `the last column for ${r.name} should name a privacy-page row in quotes, or start with Not yet / Not needed`);
    assert.ok(privacy.includes(title), `www/privacy.html has no row "${title}" (for ${r.name})`);
  });
}
