// The Android app icon (parent's choice, 17 Nov 2026): the files in www/app-icon/ and the step that puts them into the app.
//   www/app-icon/icon-512.png        the same picture as the Google Play store icon (512 x 512, under 1 MB)
//   www/app-icon/android-res/        the icon in every size Android asks for, copied over the Android project's res folder
//   package.json "capacitor:sync:after"  does the copying whenever `npx cap sync android` runs (the build runs it)
// The pictures are drawn by scripts/app-icon.py. Run from the repository root:  node --test scripts/tests/app-icon.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = path.join(root, 'www', 'app-icon');
const pngSize = file => {
  const b = fs.readFileSync(file);
  assert.equal(b.subarray(1, 4).toString(), 'PNG', file + ' is not a PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

test('the store icon is 512 x 512 and under 1 MB', () => {
  const f = path.join(dir, 'icon-512.png');
  assert.deepEqual(pngSize(f), [512, 512]);
  assert.ok(fs.statSync(f).size < 1024 * 1024);
});

test('the Android icon exists in every size, square, round and in two layers', () => {
  const scale = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [name, s] of Object.entries(scale)) {
    const d = path.join(dir, 'android-res', 'mipmap-' + name);
    for (const f of ['ic_launcher.png', 'ic_launcher_round.png']) assert.deepEqual(pngSize(path.join(d, f)), [48 * s, 48 * s], name + '/' + f);
    for (const f of ['ic_launcher_foreground.png', 'ic_launcher_background.png']) assert.deepEqual(pngSize(path.join(d, f)), [108 * s, 108 * s], name + '/' + f);
  }
  for (const f of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
    const xml = fs.readFileSync(path.join(dir, 'android-res', 'mipmap-anydpi-v26', f), 'utf8');
    assert.match(xml, /@mipmap\/ic_launcher_background/);
    assert.match(xml, /@mipmap\/ic_launcher_foreground/);
  }
});

test('syncing the Android project copies the icon into it', () => {
  const hook = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts['capacitor:sync:after'];
  assert.ok(hook, 'package.json has no capacitor:sync:after step');
  assert.match(hook, /www\/app-icon\/android-res/);
  assert.match(hook, /android\/app\/src\/main\/res/);
  // Run the step on a stand-in Android project and look at what it left
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drenerics-icon-test-'));
  try {
    fs.cpSync(path.join(root, 'www', 'app-icon'), path.join(tmp, 'www', 'app-icon'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'android/app/src/main/res'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'android/app/src/main/assets/public/app-icon'), { recursive: true });
    const code = hook.match(/^node -e "(.*)"$/s)[1];
    new Function('require', 'process', code)(m => (m === 'fs' ? { ...fs, existsSync: p => fs.existsSync(path.join(tmp, p)), cpSync: (a, b, o) => fs.cpSync(path.join(tmp, a), path.join(tmp, b), o), rmSync: (p, o) => fs.rmSync(path.join(tmp, p), o) } : null), process);
    assert.deepEqual(pngSize(path.join(tmp, 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png')), [192, 192]);
    assert.ok(!fs.existsSync(path.join(tmp, 'android/app/src/main/assets/public/app-icon')), 'the icon files should not stay inside the app\'s web files');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
