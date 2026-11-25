// Runs the full test suite but stops as soon as N tests have failed, so a broken build is found in minutes, not after every test.
//   node scripts/test-stop-after.mjs        stop after 3 failed tests (the default)
//   node scripts/test-stop-after.mjs 1      stop at the first failure
// It prints the names of the failed tests and the command to run only those (fix, then run that command, then npm test).
// It never changes a test: a stopped run is a FAILED run. A full npm test is still needed before a push.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testDir = path.join(root, 'scripts', 'tests');
export const DEFAULT_LIMIT = 3;

// Names of the failed tests in TAP output from node --test (top-level lines "not ok N - name")
export function failedNames(tapText) {
  const names = [];
  for (const line of tapText.split('\n')) {
    const m = /^not ok \d+ - (.*)$/.exec(line);
    if (m) names.push(m[1].trim());
  }
  return names;
}

// Whether the run must stop now: N or more failures seen
export function shouldStop(failureCount, limit) {
  return failureCount >= limit;
}

// A test name pattern that matches exactly these names
export function namePattern(names) {
  return '^(?:' + names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')$';
}

export function parseLimit(arg) {
  if (arg === undefined) return DEFAULT_LIMIT;
  const n = Number(arg);
  if (!Number.isInteger(n) || n < 1) throw new Error(`The limit must be a whole number of 1 or more, got "${arg}"`);
  return n;
}

function main() {
  let limit;
  try { limit = parseLimit(process.argv[2]); } catch (e) { console.error(e.message); return 2; }
  const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.mjs')).sort().map(f => path.join('scripts', 'tests', f));
  const child = spawn(process.execPath, ['--test', '--test-reporter=tap', ...files], { cwd: root, detached: true });
  let out = '';
  let seen = [];
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try { process.kill(-child.pid, 'SIGTERM'); } catch (e) { /* already finished */ }
  };
  const onData = chunk => {
    const text = chunk.toString();
    process.stdout.write(text);
    out += text;
    seen = failedNames(out);
    if (!stopped && shouldStop(seen.length, limit)) stop();
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', d => process.stderr.write(d));
  child.on('close', code => {
    seen = failedNames(out);
    if (stopped) {
      console.log(`\nStopped after ${seen.length} failed test(s) (limit ${limit}). The rest were not run.`);
    } else if (code === 0) {
      console.log('\nAll tests passed.');
      return process.exit(0);
    } else {
      console.log(`\nTests finished with ${seen.length} failed test(s).`);
    }
    if (seen.length) {
      console.log('Failed tests:');
      for (const n of seen) console.log('  - ' + n);
      console.log('Run only these again:');
      console.log(`  node --test --test-name-pattern='${namePattern(seen).replace(/'/g, "'\\''")}' scripts/tests/*.test.mjs`);
    }
    process.exit(1);
  });
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
