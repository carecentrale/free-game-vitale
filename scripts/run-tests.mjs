// Runs every test once, then reruns failed browser tests a single time. Used by the build (scripts/build-android.ps1).
// Why: on the build laptop the browser tests that depend on drawn frames sometimes miss one (a different test each run),
// while the same test passes on the next try. A real bug fails twice and still stops the build. A test that passes only
// on the rerun is reported as FLAKY, so it can be made steadier later (the weekly build machine tune-up looks for these).
// Reruns happen only when every failure is a browser test and there are at most 3 of them; anything else fails at once.
//   node scripts/run-tests.mjs        prints the usual test output, then one summary line starting with "Tests:"
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testDir = path.join(root, 'scripts', 'tests');
const browserFile = path.join(testDir, 'browser.test.mjs');
export const MAX_RETRY = 3;

const decode = s => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// The test cases in a JUnit report from node --test: [{ name, failed }]
export function parseJunit(xml) {
  const cases = [];
  for (const m of xml.matchAll(/<testcase\b([^>]*)>/g)) {
    const attrs = m[1];
    const name = /\bname="([^"]*)"/.exec(attrs);
    if (!name) continue;
    cases.push({ name: decode(name[1]), failed: /\bfailure="/.test(attrs) });
  }
  return cases;
}

// Whether a test with this name is defined in the browser test file
export function isBrowserTest(name, browserSource) {
  return browserSource.includes(`test('${name}'`) || browserSource.includes(`test('${name.replace(/'/g, "\\'")}'`);
}

// What to do after the first run: 'ok', 'retry' (with the names) or 'fail'
export function decide(exitCode, cases, browserSource) {
  const failed = cases.filter(c => c.failed).map(c => c.name);
  if (exitCode === 0 && !failed.length) return { action: 'ok', failed };
  if (!failed.length) return { action: 'fail', failed, why: 'the tests stopped without a list of failures' };
  if (failed.length > MAX_RETRY) return { action: 'fail', failed, why: `${failed.length} tests failed (reruns are only for up to ${MAX_RETRY})` };
  const other = failed.filter(n => !isBrowserTest(n, browserSource));
  if (other.length) return { action: 'fail', failed, why: 'not only browser tests failed: ' + other.join('; ') };
  return { action: 'retry', failed };
}

// A pattern that matches exactly these test names
export const namePattern = names => '^(?:' + names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')$';

function runNode(args, xml) {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=spec', '--test-reporter-destination=stdout',
    '--test-reporter=junit', `--test-reporter-destination=${xml}`, ...args], { stdio: 'inherit', cwd: root });
  let cases = [];
  try { cases = parseJunit(fs.readFileSync(xml, 'utf8')); } catch (e) { /* no report: treated as a failure without a list */ }
  return { code: r.status, cases };
}

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drenerics-tests-'));
  const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.mjs')).sort().map(f => path.join('scripts', 'tests', f));
  const first = runNode(files, path.join(tmp, 'all.xml'));
  const total = first.cases.length;
  const d = decide(first.code, first.cases, fs.readFileSync(browserFile, 'utf8'));
  const passed = total - d.failed.length;
  if (d.action === 'ok') { console.log(`\nTests: ${total} run, ${total} passed, 0 failed.`); return 0; }
  if (d.action === 'fail') { console.log(`\nTests: ${total} run, ${passed} passed, ${d.failed.length} failed (${d.why}).`); return 1; }
  console.log(`\nRerunning ${d.failed.length} failed browser test(s) once: ${d.failed.join('; ')}`);
  const second = runNode([`--test-name-pattern=${namePattern(d.failed)}`, path.join('scripts', 'tests', 'browser.test.mjs')], path.join(tmp, 'retry.xml'));
  const still = second.cases.filter(c => c.failed).map(c => c.name);
  const ran = second.cases.map(c => c.name);
  const missing = d.failed.filter(n => !ran.includes(n));
  if (second.code === 0 && !still.length && !missing.length) {
    for (const n of d.failed) console.log(`FLAKY (failed, then passed on the rerun): ${n}`);
    console.log(`\nTests: ${total} run, ${total} passed, 0 failed (${d.failed.length} flaky: passed on the rerun).`);
    return 0;
  }
  console.log(`\nTests: ${total} run, ${passed} passed, ${d.failed.length} failed; still failing on the rerun: ${[...still, ...missing].join('; ') || 'see above'}.`);
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
