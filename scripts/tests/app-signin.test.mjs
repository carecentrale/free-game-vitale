// Google sign-in inside the Android app (0.6.105): the rules in the code and in the app's settings.
// It cannot be tried in the test browser (it needs a phone with a Google account). Run:  node --test scripts/tests/app-signin.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const game = read('build/prototype-3d-v7.html');
const code = game.slice(game.indexOf('// ---- Google sign-in inside the Android app (0.6.105'), game.indexOf("$c('cloudGoogle').addEventListener"));

test('the app has the sign-in add-on with Google only: no Facebook code, so no advertising ID permission in a children\'s app', () => {
  const pkg = JSON.parse(read('package.json')), cap = JSON.parse(read('capacitor.config.json'));
  assert.ok(pkg.dependencies['@capgo/capacitor-social-login'], 'the add-on is a dependency, so the build installs it');
  assert.deepEqual(cap.plugins.SocialLogin.providers, { google: true, facebook: false, apple: false, twitter: false });
  assert.equal(cap.appId, 'com.drenerics.adventurers');
});

test('in the app the phone\'s Google window signs the grown-up in and the game goes on where it was; a browser signs in as before', () => {
  assert.match(code, /C\.isNativePlatform && C\.isNativePlatform\(\) && C\.Plugins && C\.Plugins\.SocialLogin/);
  assert.match(code, /plugin\.initialize\(\{ google: \{ webClientId: GOOGLE_WEB_CLIENT_ID, skipAuthOnlyAuthorizationAfterSignIn: true \} \}\)/);
  assert.match(code, /plugin\.login\(\{ provider: 'google', options: \{\} \}\)/, 'no extra permissions are asked of the Google account');
  assert.match(code, /res\.result\.idToken/);
  assert.match(code, /sb\.auth\.signInWithIdToken\(\{ provider: 'google', token \}\)/, 'the database checks Google\'s signed token');
  assert.match(code, /sb\.auth\.signInWithOAuth\(\{ provider, options: \{ redirectTo: location\.origin \+ location\.pathname \} \}\)/, 'the browser way is unchanged');
  assert.match(code, /if \(plugin\) return cloudSignInApp\(plugin\);/);
  assert.match(game, /await p\.logout\(\{ provider: 'google' \}\)/, 'signing out also signs the app out of the Google window');
});

test('nothing about the account is recorded, and no secret is in the game', () => {
  for (const m of code.matchAll(/logEvent\('signin_app', ([^)]*)\)/g)) assert.match(m[1], /^'(ok|no token|refused|closed or failed|not set up)'$/, m[1]);
  assert.doesNotMatch(code, /logEvent\([^)]*(email|token\b|res\.|user)/);
  assert.match(game, /const GOOGLE_WEB_CLIENT_ID = '([0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com)?';/, 'empty, or a Web client ID (public, not a secret)');
  assert.doesNotMatch(game, /GOCSPX-|client_secret/i, 'never a client secret');
  assert.match(read('docs/EVENTS.md'), /`signin_app`/);
});
