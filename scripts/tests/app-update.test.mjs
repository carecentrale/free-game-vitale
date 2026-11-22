// Getting the new version (0.6.80, SPEC-019): Google Play's in-app update in the Android app.
// The game's update code is taken from the game file and run here against a pretend Google Play (no browser, no phone).
// The device test with two Play builds on the internal test track is the owner's (done-when lines 1, 2 and 5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const game = read('build/prototype-3d-v7.html');
const admin = read('build/admin.html');
const start = game.indexOf('// ---- Getting the new version (0.6.80');
const end = game.indexOf('// ---- Startup ----');
const code = game.slice(start, end);

function el() {
  const e = { style: {}, textContent: '', innerHTML: '', children: [], listeners: {},
    addEventListener(k, f) { this.listeners[k] = f; }, appendChild(c) { this.children.push(c); },
    click() { this.listeners.click && this.listeners.click(); } };
  return e;
}
// A pretend Google Play. info: what getAppUpdateInfo answers; immediate: the result code of the full-screen page
function fakePlay(info, { immediate = 0, hang = false } = {}) {
  const calls = [];
  return { calls, listener: null,
    getAppUpdateInfo() { calls.push('info'); return hang ? new Promise(() => {}) : Promise.resolve(info); },
    performImmediateUpdate() { calls.push('immediate'); return Promise.resolve({ code: immediate }); },
    startFlexibleUpdate() { calls.push('flexible'); return Promise.resolve({ code: 0 }); },
    completeFlexibleUpdate() { calls.push('complete'); return Promise.resolve(); },
    addListener(name, f) { calls.push('listen:' + name); this.listener = f; return Promise.resolve({ remove() {} }); } };
}
function load({ days = null, saveWorks = true, cloud = async () => true, native = false } = {}) {
  const ids = { parentArea: el() };
  ids.parentArea.style.display = 'none';   // the parent area is closed, as when the game opens
  const store = new Map();
  if (days !== null) store.set('kidsgame.forceUpdateDays', String(days));
  const ctx = {
    console, Promise, setTimeout, clearTimeout, JSON, Number, String, Date,
    setInterval: () => 0,
    SB_URL: 'https://x', SB_KEY: 'k',
    fetch: () => Promise.reject(new Error('offline')),
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)) },
    document: {
      body: el(), hidden: false, listeners: {},
      createElement() { return el(); },
      getElementById(id) { if (!ids[id]) ids[id] = el(); return ids[id]; },
      addEventListener(k, f) { this.listeners[k] = f; },
    },
    window: native ? { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android', isPluginAvailable: () => false, Plugins: {} } } : {},
    settingsOpen: false, bagOpen: false, powersOpen: false, quitOpen: false, tradePanel: null, quizPanel: null, tipPanel: null,
    lastFightAt: 0, activeSlot: 0, paused: false, exited: 0,
    slotKey: n => 'slot' + n,
    saveGame() { if (saveWorks) store.set('slot0', JSON.stringify({ at: Date.now() })); },
    cloudSaveForUpdate: cloud,
    appPlugin: () => ({ exitApp() { ctx.exited++; } }),
  };
  vm.createContext(ctx);
  // the game's let/const live in its own scope: hand the pieces the test needs back out
  vm.runInContext(code.replace(/\blet paused\b/, 'var paused') +
    ';this.t = { upd, updCheck, updTick, updSafe, updForced, updSave, updScreen, updBtn };', ctx);
  // the update code reads the game's flags by name: keep them on the context so the test can change them
  return { ctx, t: ctx.t, ids, store };
}
const tick = () => new Promise(r => setTimeout(r, 0));
const AVAILABLE = { updateAvailability: 2, flexibleUpdateAllowed: true, immediateUpdateAllowed: true };

test('the update code is in the game, before the startup', () => {
  assert.ok(start > 0 && end > start);
});

test('done-when 1: within the limit, Google\'s small window, then Restart saves and installs', async () => {
  const { t } = load({ days: 30 });
  const play = fakePlay({ ...AVAILABLE, clientVersionStalenessDays: 3 });
  t.upd.plugin = play;
  await t.updCheck();
  assert.equal(t.upd.want, 'flex');
  assert.equal(t.upd.line, 'New version ready');
  t.updTick(); await tick();
  assert.deepEqual(play.calls, ['info', 'listen:onFlexibleUpdateStateChange', 'flexible']);
  assert.equal(t.updBtn.style.display, 'none', 'no restart button before the download is done');
  play.listener({ installStatus: 11 });
  t.updTick();
  assert.equal(t.updBtn.style.display, 'block');
  assert.equal(t.updBtn.textContent, 'Restart to get the new version');
  t.updBtn.click(); await tick(); await tick();
  assert.equal(play.calls.at(-1), 'complete');
});

test('closing Google\'s small window: no second window until the game opens again', async () => {
  const { t } = load({ days: 30 });
  const play = fakePlay({ ...AVAILABLE, clientVersionStalenessDays: 1 });
  t.upd.plugin = play;
  await t.updCheck(); t.updTick(); await tick();
  await t.updCheck();                        // coming back from the background
  assert.equal(t.upd.want, null);
  assert.equal(play.calls.filter(c => c === 'flexible').length, 1);
});

test('opened with the new version downloaded: Restart now', async () => {
  const { t } = load({ days: 30 });
  t.upd.plugin = fakePlay({ updateAvailability: 2, installStatus: 11, clientVersionStalenessDays: 2 });
  await t.updCheck();
  assert.equal(t.upd.downloaded, true);
  assert.equal(t.upd.want, null);
});

test('done-when 2 and 5: past the limit, the game saves and Google\'s full-screen page shows', async () => {
  const { t, store } = load({ days: 30 });
  const play = fakePlay({ ...AVAILABLE, clientVersionStalenessDays: 31 });
  t.upd.plugin = play;
  await t.updCheck();
  assert.equal(t.upd.want, 'force');
  t.updTick(); await tick(); await tick();
  assert.ok(store.get('slot0'), 'saved first');
  assert.ok(play.calls.includes('immediate'));
  assert.ok(!play.calls.includes('flexible'));
});

test('done-when 2: limit 0 forces every new version at once, even with no days reported', async () => {
  const { t } = load({ days: 0 });
  t.upd.plugin = fakePlay({ ...AVAILABLE });
  await t.updCheck();
  assert.equal(t.upd.want, 'force');
});

test('no days reported by Google Play: the background update is used', async () => {
  const { t } = load({ days: 30 });
  t.upd.plugin = fakePlay({ ...AVAILABLE });
  await t.updCheck();
  assert.equal(t.upd.want, 'flex');
});

test('done-when 2: closing Google\'s full-screen page shows "A new version is needed", never Google\'s page again by itself', async () => {
  const { t, ctx, ids } = load({ days: 0 });
  const play = fakePlay({ ...AVAILABLE }, { immediate: 1 });
  t.upd.plugin = play;
  await t.updCheck(); t.updTick(); await tick(); await tick();
  assert.equal(t.upd.blocked, true);
  assert.equal(t.updScreen.style.display, 'flex');
  assert.equal(ids.updText.textContent, 'A new version is needed to keep playing.');
  assert.equal(ctx.paused, true, 'the old version cannot be played');
  await t.updCheck(); t.updTick(); t.updTick(); await tick();
  assert.equal(play.calls.filter(c => c === 'immediate').length, 1, 'not reopened in a loop');
  ids.updGo.click(); await tick(); await tick();
  assert.equal(play.calls.filter(c => c === 'immediate').length, 2, 'Update opens it again');
  ids.updQuit.click();
  assert.equal(ctx.exited, 1);
});

test('a failed save: "Could not save. Try again", and Google\'s page waits', async () => {
  const { t, ids } = load({ days: 0, saveWorks: false });
  const play = fakePlay({ ...AVAILABLE });
  t.upd.plugin = play;
  await t.updCheck(); t.updTick(); await tick(); await tick();
  assert.equal(ids.updText.textContent, 'Could not save. Try again');
  assert.ok(!play.calls.includes('immediate'));
});

test('a failed cloud save also stops the restart', async () => {
  const { t } = load({ days: 30, cloud: async () => false });
  const play = fakePlay({ updateAvailability: 2, installStatus: 11 });
  t.upd.plugin = play;
  await t.updCheck(); t.updTick();
  t.updBtn.click(); await tick(); await tick();
  assert.equal(t.updBtn.textContent, 'Could not save. Try again');
  assert.ok(!play.calls.includes('complete'));
});

test('never during a fight, a quiz, Vital\'s tips, a menu or the parent area', async () => {
  const { t, ctx, ids } = load({ days: 0 });
  const play = fakePlay({ ...AVAILABLE });
  t.upd.plugin = play;
  await t.updCheck();
  for (const [k, v] of [['settingsOpen', true], ['bagOpen', true], ['powersOpen', true], ['quitOpen', true], ['tradePanel', {}], ['quizPanel', {}], ['tipPanel', {}], ['lastFightAt', Date.now()]]) {
    const old = ctx[k]; ctx[k] = v;
    assert.equal(t.updSafe(), false, k);
    t.updTick(); await tick();
    ctx[k] = old;
  }
  ids.parentArea.style.display = 'flex';
  assert.equal(t.updSafe(), false, 'parent area');
  t.updTick(); await tick();
  assert.ok(!play.calls.includes('immediate'));
  ids.parentArea.style.display = 'none';
  assert.equal(t.updSafe(), true);
});

test('done-when 4: no internet or Google Play not answering within 5 seconds: no message, play on', async () => {
  const { t } = load({ days: 0 });
  t.upd.plugin = fakePlay(null, { hang: true });
  const started = Date.now();
  await t.updCheck();
  assert.ok(Date.now() - started < 6000);
  assert.equal(t.upd.want, null); assert.equal(t.upd.line, ''); assert.equal(t.upd.blocked, false);
  t.upd.plugin = { getAppUpdateInfo: () => Promise.reject(new Error('Install Error(-6): not installed from Google Play')) };
  await t.updCheck();
  assert.equal(t.upd.line, ''); assert.equal(t.upd.blocked, false);
});

test('done-when 4: the website game and an app without the plugin do nothing', async () => {
  for (const native of [false, true]) {
    const { t } = load({ native });
    await t.updCheck();
    assert.equal(t.upd.line, ''); assert.equal(t.upd.want, null);
  }
});

test('up to date: Settings says so', async () => {
  const { t } = load();
  t.upd.plugin = fakePlay({ updateAvailability: 1 });
  await t.updCheck();
  assert.equal(t.upd.line, 'Up to date');
});

test('the limit: 30 without the internet, the last value kept on the device otherwise', () => {
  assert.equal(load().t.upd.days, 30);
  assert.equal(load({ days: 12 }).t.upd.days, 12);
  assert.equal(load({ days: 500 }).t.upd.days, 30, 'a kept value outside 0 to 180 is not used');
  assert.match(code, /game_settings\?key=eq\.force_update_days&select=value/);
});

test('no Play Store button or link inside the game', () => {
  assert.ok(!/openAppStore/.test(game));
  assert.ok(!/play\.google\.com\/store|market:\/\//.test(game));
});

test('done-when 3: the admin card refuses values outside 0 to 180 and reports a refused change', () => {
  assert.match(admin, /<b>Forced update \(owner only\)<\/b>/);
  assert.match(admin, /Force the update when a new version has waited this many days/);
  assert.match(admin, /id="forceDays" type="number" min="0" max="180"/);
  assert.match(admin, /!Number\.isInteger\(v\) \|\| v < 0 \|\| v > 180/);
  assert.match(admin, /only the owner\\'s account can change this/);
  assert.match(admin, /last changed/);
});

test('migration 0011: one setting, 0 to 180, starting at 30, under the rules of 0009', () => {
  const m = read('docs/migrations/0011_force_update_days.sql');
  assert.match(m, /'force_update_days'\)\)/);
  assert.match(m, /value between 0 and 180/);
  assert.match(m, /values \('force_update_days', 30\)/);
  assert.ok(!/create policy|grant /i.test(m), 'no new access rule');
});

test('the plugin is in the app\'s packages', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.dependencies['@capawesome/capacitor-app-update'] || '', /^\^8\./);
  assert.ok(read('package-lock.json').includes('node_modules/@capawesome/capacitor-app-update'));
});
