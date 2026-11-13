// Uploads a signed Android app file (.aab) to Google Play from this PC. No GitHub needed, and nothing to install:
// it uses only what comes with Node.js.
//
//   node scripts/upload-play.mjs releases\drenerics-0.6.58-code9.aab     upload to the internal testing track
//   node scripts/upload-play.mjs --check                                 only check that the key can reach the app (uploads nothing)
//   Options: --track internal|alpha|beta|production (default internal), --key <path to the service account JSON file>
//
// The key is the Play Console service account JSON file. It is read from
//   Desktop\Claude tools for access\play-service-account.json
// It is a secret: it never goes into the project folder or into git.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/';
const UPLOAD_API = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/';
export const DEFAULT_KEY = path.join(os.homedir(), 'Desktop', 'Claude tools for access', 'play-service-account.json');

const b64url = v => Buffer.from(v).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

// The signed request that Google exchanges for a one-hour access token
export function makeJwt(key, now = Math.floor(Date.now() / 1000)) {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({
    iss: key.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: key.token_uri || 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const sig = crypto.createSign('RSA-SHA256').update(head + '.' + body).sign(key.private_key);
  return head + '.' + body + '.' + b64url(sig);
}

// Plain-language help for the errors Google sends most often
export function hint(status, message) {
  const m = String(message || '');
  if (/not been used in project|is disabled/i.test(m)) return 'Switch on the "Google Play Android Developer API" for the service account\'s Google Cloud project, wait a few minutes, and try again.';
  if (status === 401 || /invalid_grant|invalid_client/i.test(m)) return 'Google did not accept the key. Download a new JSON key for the service account and save it over the old file.';
  if (status === 403) return 'The service account is not allowed to release this app. In Play Console > Users and permissions, invite the service account\'s email and give it the release permissions for this app. It can take up to a day to start working.';
  if (status === 404) return 'Google Play does not know this app ID for this account. Check the appId in capacitor.config.json, and that the app exists in the same Play Console account as the service account.';
  if (/version code .* has already been used/i.test(m)) return 'This build number is already on Google Play. Build again: each build gets the next number.';
  return '';
}

class PlayError extends Error {
  constructor(step, status, message) {
    super(`${step} failed (${status}): ${message}`);
    this.step = step; this.status = status; this.googleMessage = message; this.hint = hint(status, message);
  }
}

async function call(fetchFn, step, url, opts) {
  const res = await fetchFn(url, opts);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { /* not JSON: the text is shown as it is */ }
  if (!res.ok) throw new PlayError(step, res.status, data?.error?.message || data?.error_description || data?.error || text.slice(0, 500) || res.statusText);
  return data;
}

// Uploads the file and puts it on the track. With check: true it only signs in and opens (then discards) an edit.
export async function uploadToPlay({ key, packageName, aab, track = 'internal', check = false, fetchFn = fetch, log = console.log }) {
  if (!key?.client_email || !key?.private_key) throw new Error('The key file is not a service account key (it has no client_email or private_key).');
  log(`Signing in to Google as ${key.client_email}`);
  const token = (await call(fetchFn, 'Signing in', key.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: makeJwt(key) }),
  })).access_token;
  const auth = { authorization: 'Bearer ' + token };
  const json = { ...auth, 'content-type': 'application/json' };
  const app = API + encodeURIComponent(packageName);

  const edit = await call(fetchFn, 'Opening the app in Google Play', app + '/edits', { method: 'POST', headers: json, body: '{}' });
  if (check) {
    await call(fetchFn, 'Closing the check', `${app}/edits/${edit.id}`, { method: 'DELETE', headers: auth });
    log(`The key works: it can reach ${packageName} on Google Play. Nothing was uploaded.`);
    return { checked: true };
  }

  log(`Uploading ${path.basename(aab)} (${(fs.statSync(aab).size / 1048576).toFixed(1)} MB)`);
  const bundle = await call(fetchFn, 'Uploading the app file', `${UPLOAD_API}${encodeURIComponent(packageName)}/edits/${edit.id}/bundles?uploadType=media`, {
    method: 'POST', headers: { ...auth, 'content-type': 'application/octet-stream' }, body: fs.readFileSync(aab),
  });
  const versionCode = bundle.versionCode;

  // An app that has never been published only accepts draft releases, so try "completed" first and fall back to "draft"
  let status = 'completed';
  const setTrack = s => call(fetchFn, `Putting build ${versionCode} on the ${track} track`, `${app}/edits/${edit.id}/tracks/${track}`, {
    method: 'PUT', headers: json, body: JSON.stringify({ track, releases: [{ versionCodes: [String(versionCode)], status: s }] }),
  });
  try { await setTrack(status); }
  catch (e) {
    if (!/draft/i.test(e.googleMessage || '')) throw e;
    status = 'draft';
    await setTrack(status);
  }
  await call(fetchFn, 'Saving the release', `${app}/edits/${edit.id}:commit`, { method: 'POST', headers: auth });
  log(`Done: build ${versionCode} is on the ${track} track` + (status === 'draft' ? ' as a draft. Open Play Console to send it out.' : '.'));
  return { versionCode, track, status };
}

// ---- Run from the command line ----
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = name => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : null; };
  const keyPath = opt('--key') || process.env.PLAY_SERVICE_ACCOUNT_FILE || DEFAULT_KEY;
  const track = opt('--track') || 'internal';
  const check = args.includes('--check');
  const aab = args.find(a => !a.startsWith('--'));
  const stop = msg => { console.error('\nUPLOAD STOPPED: ' + msg); process.exit(1); };
  if (!check && !aab) stop('Give the .aab file to upload, or --check to test the key.');
  if (!check && !fs.existsSync(aab)) stop('File not found: ' + aab);
  if (!fs.existsSync(keyPath)) stop(`The Play service account key was not found at\n  ${keyPath}\nSave the JSON key file there (see docs/RELEASE.md, "Uploading from this PC").`);
  let key;
  try { key = JSON.parse(fs.readFileSync(keyPath, 'utf8')); } catch (e) { stop('The key file is not valid JSON: ' + keyPath); }
  const packageName = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8')).appId;
  uploadToPlay({ key, packageName, aab, track, check }).catch(e => stop(e.message + (e.hint ? '\nWhat to do: ' + e.hint : '')));
}
