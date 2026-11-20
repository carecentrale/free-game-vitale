// Build reports for the Cost and Build Optimizer agent.
// After every build the build watcher runs:   node build-report.mjs build <mode> <result> <exit code> "<start>" "<end>" <log file>
// About once an hour it runs:                 node build-report.mjs weekly
// The reports go to the Google Drive folder "Adventurers of Drenerics - Build machine reports" (Google Drive for desktop,
// usually G:\My Drive\...). Another folder can be named in build-requests\reports-folder.txt.
//   build-log.csv            one row per build: time, mode, result, minutes, version, app size, Gradle time, disk...
//   latest-build.txt         the last build in words, with the last error lines when it failed
//   machine-weekly-<date>.txt  once a week: the machine-status.ps1 report (the last 12 are kept)
// Safety: only numbers and log lines go out, and every line passes clean(): lines that look like a key, password or token
// are dropped, and email addresses are hidden. Nothing here ever reads the key files.
// A report problem never stops a build: errors go to build-requests\watcher-errors.log and the exit code is 0.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const FOLDER_NAME = 'Adventurers of Drenerics - Build machine reports';
const CSV_HEADER = 'finished,mode,result,exit_code,minutes,version,build_number,app_mb,gradle_seconds,gradle_tasks,gradle_tasks_executed,npm_ci_skipped,tests,old_builds_removed,builds_kept,releases_mb,disk_free_gb';

const SECRET = /(password|passwd|secret|token|bearer|authorization|private[ _-]?key|api[ _-]?key|BEGIN [A-Z ]*KEY|storePass|keyPass|client_secret|credential)/i;
const LONG_BLOB = /[A-Za-z0-9+/=_-]{40,}/;   // base64-like strings: keys and tokens look like this
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// One line made safe to publish, or null when it must be dropped.
export function clean(line) {
  const s = String(line ?? '');
  if (SECRET.test(s)) return null;
  // Git commit ids (hex) and URLs are fine; other long blobs are not.
  const blob = s.replace(/https?:\/\/\S+/g, '').replace(/\b[0-9a-f]{7,40}\b/g, '');
  if (LONG_BLOB.test(blob)) return null;
  return s.replace(EMAIL, '[email hidden]');
}
export function cleanText(text) {
  return String(text ?? '').split(/\r?\n/).map(clean).filter((l) => l !== null).join('\n');
}

// The numbers in one build log (build-android.ps1's output).
export function parseLog(text) {
  const t = String(text ?? '');
  const m = (re) => { const x = t.match(re); return x ? x[1] : ''; };
  let gradleSeconds = '';
  const g = t.match(/BUILD (?:SUCCESSFUL|FAILED) in (?:(\d+)h )?(?:(\d+)m )?(\d+)s/);
  if (g) gradleSeconds = String((+(g[1] || 0)) * 3600 + (+(g[2] || 0)) * 60 + (+g[3]));
  const tasks = t.match(/(\d+) actionable tasks?: (.*)/);
  let executed = '';
  if (tasks) { const e = tasks[2].match(/(\d+) executed/); executed = e ? e[1] : '0'; }
  let tests = 'not run';
  if (/Tests skipped/.test(t)) tests = 'skipped';
  else { const p = t.match(/Tests: ([^\r\n]*)/) || t.match(/# pass (\d+)/); if (p) tests = p[1]; }
  return {
    version: m(/Version ([0-9][0-9.]*), build number/),
    buildNumber: m(/build number (\d+)/),
    appMb: m(/Uploading \S+ \(([\d.]+) MB\)/),
    appFile: m(/App file: ([^\r\n]+\.aab)/).trim(),
    gradleSeconds,
    gradleTasks: tasks ? tasks[1] : '',
    gradleExecuted: executed,
    npmCiSkipped: /npm ci skipped/.test(t) ? 'yes' : (/npm ci/.test(t) ? 'no' : ''),
    tests,
    oldRemoved: String((t.match(/Old build removed:/g) || []).length),
    stopped: m(/((?:BUILD|UPLOAD) STOPPED:[^\r\n]*)/),
  };
}

const csvCell = (v) => { const s = String(v ?? ''); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export const csvRow = (cells) => cells.map(csvCell).join(',');

export function minutesBetween(start, end) {
  const a = Date.parse(String(start).replace(' ', 'T')), b = Date.parse(String(end).replace(' ', 'T'));
  return Number.isFinite(a) && Number.isFinite(b) ? ((b - a) / 60000).toFixed(1) : '';
}

// The Drive folder: the one named in reports-folder.txt, else "<drive>:\My Drive\<FOLDER_NAME>" on any drive letter.
export function findReportsFolder(requestsDir, exists = fs.existsSync, read = (p) => fs.readFileSync(p, 'utf8')) {
  const cfg = path.join(requestsDir, 'reports-folder.txt');
  if (exists(cfg)) { const p = read(cfg).trim(); if (p && exists(p)) return p; }
  for (const d of 'GHIJKLMNOPQRSTUVWXYZDEF') {
    const p = `${d}:\\My Drive\\${FOLDER_NAME}`;
    if (exists(p)) return p;
  }
  return null;
}

function folderMb(dir) {
  let total = 0;
  try { for (const f of fs.readdirSync(dir, { withFileTypes: true })) if (f.isFile()) total += fs.statSync(path.join(dir, f.name)).size; } catch { return ''; }
  return (total / 1048576).toFixed(0);
}
function diskFreeGb(p) {
  try { const s = fs.statfsSync(p); return ((s.bavail * s.bsize) / 1073741824).toFixed(1); } catch { return ''; }
}

export function buildReport({ mode, result, code, start, end, logText, toolsDir, outDir }) {
  const info = parseLog(logText);
  const relDir = path.join(toolsDir, 'releases');
  let kept = '';
  try { kept = String(fs.readdirSync(relDir).filter((f) => f.endsWith('.aab')).length); } catch { }
  let appMb = info.appMb;
  if (!appMb && info.appFile) { try { appMb = (fs.statSync(info.appFile).size / 1048576).toFixed(1); } catch { } }
  const row = [end, mode, result, code, minutesBetween(start, end), info.version, info.buildNumber, appMb, info.gradleSeconds,
    info.gradleTasks, info.gradleExecuted, info.npmCiSkipped, info.tests, info.oldRemoved, kept, folderMb(relDir), diskFreeGb(toolsDir)];
  const csv = path.join(outDir, 'build-log.csv');
  if (!fs.existsSync(csv)) fs.writeFileSync(csv, CSV_HEADER + '\n');
  fs.appendFileSync(csv, csvRow(row) + '\n');
  const lines = [
    `Last build on the build laptop: ${result} (${mode}), started ${start}, finished ${end} (laptop time), exit code ${code}.`,
    `Version ${info.version || '?'}, build number ${info.buildNumber || '?'}, app ${appMb || '?'} MB.`,
    `Total ${minutesBetween(start, end) || '?'} min; Gradle ${info.gradleSeconds || '?'} s, ${info.gradleExecuted || '?'} of ${info.gradleTasks || '?'} tasks executed (the rest came from cache or were up to date).`,
    `npm ci skipped: ${info.npmCiSkipped || '?'}. Tests: ${info.tests}. Builds kept: ${kept || '?'} (${folderMb(relDir) || '?'} MB). Free disk: ${diskFreeGb(toolsDir) || '?'} GB.`,
  ];
  if (result !== 'OK') {
    if (info.stopped) lines.push('', clean(info.stopped) ?? '(the stop message was hidden: it looked like it held a key)');
    lines.push('', 'Last log lines (cleaned):', cleanText(String(logText).split(/\r?\n/).slice(-25).join('\n')));
  }
  lines.push('', 'Full history: build-log.csv in this folder.');
  fs.writeFileSync(path.join(outDir, 'latest-build.txt'), lines.join('\n') + '\n');
  return row;
}

// Once a week (7 days after the last one): the machine status report, cleaned, kept 12 weeks.
export function weeklyReport({ toolsDir, outDir, now = new Date(), runStatus }) {
  const stamp = path.join(toolsDir, 'build-requests', 'last-weekly-report.txt');
  let last = 0;
  try { last = Date.parse(fs.readFileSync(stamp, 'utf8').trim()) || 0; } catch { }
  if (now - last < 7 * 86400000) return null;
  const text = runStatus();
  const name = `machine-weekly-${now.toISOString().slice(0, 10)}.txt`;
  fs.writeFileSync(path.join(outDir, name), cleanText(text) + '\n');
  fs.writeFileSync(stamp, now.toISOString());
  const old = fs.readdirSync(outDir).filter((f) => /^machine-weekly-.*\.txt$/.test(f)).sort().reverse().slice(12);
  for (const f of old) { try { fs.unlinkSync(path.join(outDir, f)); } catch { } }
  return name;
}

function main(argv) {
  const toolsDir = path.dirname(fileURLToPath(import.meta.url));
  const reqDir = path.join(toolsDir, 'build-requests');
  const errLog = path.join(reqDir, 'watcher-errors.log');
  const note = (msg) => { try { fs.appendFileSync(errLog, new Date().toISOString() + '  build report: ' + msg + '\n'); } catch { } };
  try {
    const outDir = findReportsFolder(reqDir);
    if (!outDir) { note(`the Drive folder "${FOLDER_NAME}" was not found (is Google Drive for desktop running?)`); return; }
    if (argv[0] === 'build') {
      const [, mode, result, code, start, end, logFile] = argv;
      let logText = '';
      try { logText = fs.readFileSync(logFile, 'utf8'); } catch { }
      buildReport({ mode, result, code, start, end, logText, toolsDir, outDir });
    } else if (argv[0] === 'weekly') {
      weeklyReport({
        toolsDir, outDir,
        runStatus: () => execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(toolsDir, 'machine-status.ps1')], { encoding: 'utf8', timeout: 120000 }),
      });
    } else note('unknown command ' + argv[0]);
  } catch (e) { note(String(e && e.message || e)); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
