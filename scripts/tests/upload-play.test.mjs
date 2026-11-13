// Tests for scripts/upload-play.mjs (the upload to Google Play from the PC). Google is replaced by a stand-in,
// so nothing is sent anywhere. Run from the repository root:  node --test scripts/tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeJwt, uploadToPlay, hint } from '../upload-play.mjs';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const key = { client_email: 'robot@example.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
const reply = (status, body) => ({ ok: status < 400, status, statusText: '', text: async () => (body === undefined ? '' : JSON.stringify(body)) });
const aab = path.join(os.tmpdir(), 'upload-play-test.aab');
fs.writeFileSync(aab, 'not a real app file');

// A stand-in for Google: records each request and answers from the list given
function fakeGoogle(answers) {
  const calls = [];
  const fetchFn = async (url, opts) => { calls.push({ url, method: opts.method, body: opts.body, headers: opts.headers }); return answers[calls.length - 1]; };
  return { calls, fetchFn };
}

test('the sign-in request is signed with the key and names the Play publishing permission', () => {
  const [head, body, sig] = makeJwt(key, 1000).split('.');
  const claims = JSON.parse(Buffer.from(body, 'base64url').toString());
  assert.equal(claims.iss, key.client_email);
  assert.equal(claims.scope, 'https://www.googleapis.com/auth/androidpublisher');
  assert.equal(claims.exp - claims.iat, 3600);
  assert.ok(crypto.createVerify('RSA-SHA256').update(head + '.' + body).verify(publicKey, Buffer.from(sig, 'base64url')), 'signature does not verify');
});

test('an upload signs in, opens an edit, sends the file, sets the internal track and saves', async () => {
  const g = fakeGoogle([reply(200, { access_token: 'tok' }), reply(200, { id: 'e1' }), reply(200, { versionCode: 9 }), reply(200, {}), reply(200, {})]);
  const r = await uploadToPlay({ key, packageName: 'com.example.app', aab, fetchFn: g.fetchFn, log: () => {} });
  assert.deepEqual(r, { versionCode: 9, track: 'internal', status: 'completed' });
  assert.deepEqual(g.calls.map(c => c.method), ['POST', 'POST', 'POST', 'PUT', 'POST']);
  assert.match(g.calls[2].url, /\/upload\/androidpublisher\/v3\/applications\/com\.example\.app\/edits\/e1\/bundles\?uploadType=media$/);
  assert.equal(g.calls[2].headers.authorization, 'Bearer tok');
  assert.match(g.calls[3].url, /\/edits\/e1\/tracks\/internal$/);
  assert.deepEqual(JSON.parse(g.calls[3].body), { track: 'internal', releases: [{ versionCodes: ['9'], status: 'completed' }] });
  assert.match(g.calls[4].url, /\/edits\/e1:commit$/);
});

test('an app that only takes draft releases gets the build as a draft', async () => {
  const g = fakeGoogle([reply(200, { access_token: 'tok' }), reply(200, { id: 'e1' }), reply(200, { versionCode: 9 }),
    reply(400, { error: { message: 'Only releases with status draft may be created on draft app.' } }), reply(200, {}), reply(200, {})]);
  const r = await uploadToPlay({ key, packageName: 'com.example.app', aab, fetchFn: g.fetchFn, log: () => {} });
  assert.equal(r.status, 'draft');
  assert.equal(JSON.parse(g.calls[4].body).releases[0].status, 'draft');
});

test('--check signs in and opens the app, then discards the edit without uploading', async () => {
  const g = fakeGoogle([reply(200, { access_token: 'tok' }), reply(200, { id: 'e1' }), reply(204)]);
  const r = await uploadToPlay({ key, packageName: 'com.example.app', check: true, fetchFn: g.fetchFn, log: () => {} });
  assert.deepEqual(r, { checked: true });
  assert.deepEqual(g.calls.map(c => c.method), ['POST', 'POST', 'DELETE']);
});

test('a refusal from Google is reported with its own message and what to do about it', async () => {
  const g = fakeGoogle([reply(200, { access_token: 'tok' }), reply(403, { error: { message: 'The caller does not have permission' } })]);
  await assert.rejects(uploadToPlay({ key, packageName: 'com.example.app', aab, fetchFn: g.fetchFn, log: () => {} }), e => {
    assert.match(e.message, /Opening the app in Google Play failed \(403\): The caller does not have permission/);
    assert.match(e.hint, /Users and permissions/);
    return true;
  });
  assert.match(hint(401, 'invalid_grant'), /new JSON key/);
  assert.match(hint(403, 'Google Play Android Developer API has not been used in project 123 before or it is disabled'), /Switch on/);
  assert.match(hint(404, 'Package not found'), /app ID/);
});

test('a file that is not a service account key is refused before anything is sent', async () => {
  const g = fakeGoogle([]);
  await assert.rejects(uploadToPlay({ key: { type: 'something else' }, packageName: 'com.example.app', aab, fetchFn: g.fetchFn, log: () => {} }), /not a service account key/);
  assert.equal(g.calls.length, 0);
});
