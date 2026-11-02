// Release checks: the copies of the game and admin page match, the script parses,
// the page title matches the version, and the version has a changelog entry and a versions row.
// Run from the repository root:  node --test scripts/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const game = read('build/prototype-3d-v7.html');
const VERSION = game.match(/const VERSION = '([^']+)'/)?.[1];

test('the game version is found in the file', () => {
  assert.match(VERSION ?? '', /^\d+\.\d+\.\d+$/);
});

test('the page title shows the same version as the code', () => {
  assert.match(game, new RegExp(`<title>Adventurers of Drenerics v${VERSION.replaceAll('.', '\\.')} \\(3D\\)</title>`));
});

test('the live game copy matches the build file', () => {
  assert.equal(read('www/play/index.html'), game);
});

test('the live admin copy matches the build admin file', () => {
  assert.equal(read('www/admin.html'), read('build/admin.html'));
});

test('the game script passes the JavaScript syntax check', () => {
  const m = game.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(m, 'module script not found');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'game-check-'));
  const file = path.join(tmp, 'game.mjs');
  fs.writeFileSync(file, m[1]);
  // throws (fails the test) if there is a syntax error
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
});

test('the version has a changelog entry', () => {
  assert.match(read('CHANGELOG.md'), new RegExp(`^## ${VERSION.replaceAll('.', '\\.')}:`, 'm'));
});

test('the version has a row in docs/VERSIONS.md', () => {
  assert.match(read('docs/VERSIONS.md'), new RegExp(`^\\| ${VERSION.replaceAll('.', '\\.')} \\|`, 'm'));
});

test('the game history lists the version', () => {
  assert.ok(game.includes(`{ v: '${VERSION}',`), 'GAME_HISTORY has no entry for ' + VERSION);
});
