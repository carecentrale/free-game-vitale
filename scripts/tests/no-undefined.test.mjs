// Checks that the game script uses no name that is never declared (for example a constant that was
// deleted by mistake, as happened in 0.6.34). Uses ESLint's no-undef rule, if the eslint command is installed.
// Run from the repository root:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const game = fs.readFileSync(path.join(root, 'build', 'prototype-3d-v7.html'), 'utf8');
const m = game.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!m) throw new Error('module script not found in the game file');

// Runs ESLint through Node itself (not the node_modules/.bin wrapper), so it starts the same way on Windows and Linux
const ESLINT = [path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js')];
const eslint = spawnSync(process.execPath, [...ESLINT, '--version'], { encoding: 'utf8' });
const hasEslint = eslint.status === 0;
// On CI the check must run, so a missing eslint is a failure there, not a skip.
if (!hasEslint && process.env.CI) throw new Error('eslint is not installed: run npm install');

test('every name the game script uses is declared', { skip: !hasEslint && 'eslint is not installed: run npm install' }, () => {
  const r = spawnSync(process.execPath, [...ESLINT,
    '-c', path.join(here, 'eslint.game.config.mjs'),
    '--stdin', '--stdin-filename', 'scripts/tests/game-module.mjs',
  ], { input: m[1], encoding: 'utf8', cwd: root });
  assert.equal(r.status, 0, 'undefined names in the game script:\n' + (r.stdout || r.stderr));
});
