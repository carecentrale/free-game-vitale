// Quick tests, for use while working on a change. The full suite (npm test) still has to pass before a push.
//   npm run test:quick                       the fast checks only (world rules, saves, release checks): well under a minute
//   npm run test:quick -- "camera|fireball"  the fast checks, plus the browser tests whose names contain one of these words
// The browser tests need Chromium (set CHROME_PATH, or run `npx playwright install chromium`).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'tests');
const pattern = process.argv[2] || '';
const fast = fs.readdirSync(dir).filter(f => f.endsWith('.test.mjs') && f !== 'browser.test.mjs').map(f => path.join(dir, f));
const run = args => spawnSync(process.execPath, ['--test', ...args], { stdio: 'inherit' }).status;

let failed = run(fast) !== 0;
if (pattern) failed = run(['--test-name-pattern=' + pattern, path.join(dir, 'browser.test.mjs')]) !== 0 || failed;
process.exit(failed ? 1 : 0);
