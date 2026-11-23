// Every database step is kept in docs/migrations and listed in its README (22 Nov 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'migrations');
const readme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql'));

test('every migration file is listed in docs/migrations/README.md', () => {
  for (const f of files) assert.ok(readme.includes(f), f + ' is not in the README');
});

test('every file the README lists exists', () => {
  for (const [, f] of readme.matchAll(/\b(\d{4}[a-z]?_[a-z0-9_]+\.sql)\b/g)) assert.ok(files.includes(f), f + ' is listed but missing');
});
