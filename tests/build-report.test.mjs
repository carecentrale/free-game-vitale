// Tests for build-report.mjs (the build reports for the Cost and Build Optimizer). Nothing is written outside a temp folder.
// Run from the build tools folder:  node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { clean, cleanText, parseLog, csvRow, minutesBetween, findReportsFolder, buildReport, weeklyReport, FOLDER_NAME } from '../build-report.mjs';

const LOG = `== Getting the latest game from GitHub
Packages already installed in the work folder (package-lock.json unchanged): npm ci skipped.
Version 0.6.75, build number 17
Tests skipped (-SkipTests).
BUILD SUCCESSFUL in 1m 39s
155 actionable tasks: 20 executed, 135 up-to-date
Old build removed: drenerics-0.6.59-code7.aab
App file: C:\\x\\releases\\drenerics-0.6.75-code17.aab
Signing in to Google as play-uploader@adventures-of-drenerics.iam.gserviceaccount.com
Uploading drenerics-0.6.75-code17.aab (6.8 MB)
Done: build 17 is on the internal track.`;

test('lines that look like keys, passwords or tokens are dropped', () => {
  assert.equal(clean('storePassword=hunter2'), null);
  assert.equal(clean('"private_key": "-----BEGIN PRIVATE KEY-----'), null);
  assert.equal(clean('Authorization: Bearer abc'), null);
  assert.equal(clean('x MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7 y'), null);
  assert.equal(clean('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn'), null);
});

test('ordinary lines stay, commit ids and URLs are fine, emails are hidden', () => {
  assert.equal(clean('BUILD SUCCESSFUL in 39s'), 'BUILD SUCCESSFUL in 39s');
  assert.equal(clean('dd50dd6..3e48278  main -> origin/main'), 'dd50dd6..3e48278  main -> origin/main');
  assert.equal(clean('see https://docs.gradle.org/8.14.3/userguide/command_line_interface.html#sec:command_line_warnings'), 'see https://docs.gradle.org/8.14.3/userguide/command_line_interface.html#sec:command_line_warnings');
  assert.equal(clean('Signing in as robot@x.iam.gserviceaccount.com'), 'Signing in as [email hidden]');
  assert.equal(cleanText('a\npassword: x\nb'), 'a\nb');
});

test('the numbers are read from a build log', () => {
  const i = parseLog(LOG);
  assert.equal(i.version, '0.6.75');
  assert.equal(i.buildNumber, '17');
  assert.equal(i.appMb, '6.8');
  assert.equal(i.gradleSeconds, '99');
  assert.equal(i.gradleTasks, '155');
  assert.equal(i.gradleExecuted, '20');
  assert.equal(i.npmCiSkipped, 'yes');
  assert.equal(i.tests, 'skipped');
  assert.equal(i.oldRemoved, '1');
  assert.equal(parseLog('155 actionable tasks: 155 executed').gradleExecuted, '155');
  assert.equal(parseLog('BUILD STOPPED: no Java').stopped, 'BUILD STOPPED: no Java');
});

test('csv cells with commas or quotes are quoted; minutes are worked out', () => {
  assert.equal(csvRow(['a', 'b,c', 'say "hi"']), 'a,"b,c","say ""hi"""');
  assert.equal(minutesBetween('2026-11-20 11:17:55', '2026-11-20 11:19:11'), '1.3');
  assert.equal(minutesBetween('x', 'y'), '');
});

test('the Drive folder is found on any drive letter, or from reports-folder.txt', () => {
  const want = `G:\\My Drive\\${FOLDER_NAME}`;
  assert.equal(findReportsFolder('R', (p) => p === want), want);
  assert.equal(findReportsFolder('R', () => false), null);
  const cfg = path.join('R', 'reports-folder.txt');
  assert.equal(findReportsFolder('R', (p) => p === cfg || p === 'X:\\elsewhere', () => 'X:\\elsewhere\n'), 'X:\\elsewhere');
});

function temp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'build-report-'));
  const tools = path.join(d, 'tools'), out = path.join(d, 'out');
  fs.mkdirSync(path.join(tools, 'releases'), { recursive: true });
  fs.mkdirSync(path.join(tools, 'build-requests'));
  fs.mkdirSync(out);
  fs.writeFileSync(path.join(tools, 'releases', 'a.aab'), 'x');
  return { d, tools, out };
}

test('a build adds one csv row and writes latest-build.txt without the email', () => {
  const { d, tools, out } = temp();
  buildReport({ mode: 'quick', result: 'OK', code: '0', start: '2026-11-20 11:17:55', end: '2026-11-20 11:19:11', logText: LOG, toolsDir: tools, outDir: out });
  buildReport({ mode: 'quick', result: 'OK', code: '0', start: '2026-11-20 11:17:55', end: '2026-11-20 11:19:11', logText: LOG, toolsDir: tools, outDir: out });
  const csv = fs.readFileSync(path.join(out, 'build-log.csv'), 'utf8').trim().split('\n');
  assert.equal(csv.length, 3);
  assert.match(csv[0], /^finished,mode,result/);
  assert.match(csv[1], /^2026-11-20 11:19:11,quick,OK,0,1\.3,0\.6\.75,17,6\.8,99,155,20,yes,skipped,1,1,/);
  const latest = fs.readFileSync(path.join(out, 'latest-build.txt'), 'utf8');
  assert.match(latest, /OK \(quick\)/);
  assert.doesNotMatch(latest, /@/);
  fs.rmSync(d, { recursive: true, force: true });
});

test('a failed build lists its last log lines, cleaned', () => {
  const { d, tools, out } = temp();
  buildReport({ mode: 'full', result: 'FAILED', code: '1', start: 's', end: 'e', logText: 'step\nkeyPassword=abc\nBUILD STOPPED: tests failed', toolsDir: tools, outDir: out });
  const latest = fs.readFileSync(path.join(out, 'latest-build.txt'), 'utf8');
  assert.match(latest, /BUILD STOPPED: tests failed/);
  assert.doesNotMatch(latest, /keyPassword/);
  fs.rmSync(d, { recursive: true, force: true });
});

test('a failed build also shows the error lines from last-errors.log (git, upload), cleaned', () => {
  const { d, tools, out } = temp();
  buildReport({ mode: 'quick', result: 'FAILED', code: '1', start: 's', end: 'e', logText: 'step\nBUILD STOPPED: The app was built but the upload did not work.',
    errText: 'Note: Recompile with -Xlint\nclient_secret=abc\nUPLOAD STOPPED: Opening the app in Google Play failed (503): The service is currently unavailable.', toolsDir: tools, outDir: out });
  const latest = fs.readFileSync(path.join(out, 'latest-build.txt'), 'utf8');
  assert.match(latest, /Last error lines/);
  assert.match(latest, /failed \(503\)/);
  assert.doesNotMatch(latest, /client_secret|Xlint/);
  fs.rmSync(d, { recursive: true, force: true });
});

test('the weekly report runs once a week and keeps the last 12', () => {
  const { d, tools, out } = temp();
  for (let i = 1; i <= 13; i++) fs.writeFileSync(path.join(out, `machine-weekly-2026-01-${String(i).padStart(2, '0')}.txt`), 'old');
  let runs = 0;
  const runStatus = () => { runs++; return 'Disk\nC: 50 GB free\npassword=nope'; };
  const t0 = new Date('2026-11-20T12:00:00Z');
  assert.equal(weeklyReport({ toolsDir: tools, outDir: out, now: t0, runStatus }), 'machine-weekly-2026-11-20.txt');
  assert.equal(weeklyReport({ toolsDir: tools, outDir: out, now: new Date('2026-11-25T12:00:00Z'), runStatus }), null);
  assert.equal(runs, 1);
  const body = fs.readFileSync(path.join(out, 'machine-weekly-2026-11-20.txt'), 'utf8');
  assert.match(body, /C: 50 GB free/);
  assert.doesNotMatch(body, /password/);
  assert.equal(fs.readdirSync(out).filter((f) => f.startsWith('machine-weekly-')).length, 12);
  assert.ok(weeklyReport({ toolsDir: tools, outDir: out, now: new Date('2026-11-27T12:00:01Z'), runStatus }));
  fs.rmSync(d, { recursive: true, force: true });
});
