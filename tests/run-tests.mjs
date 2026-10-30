// Run with: npm test (from the tests folder). Prints PASS/FAIL per check and exits non-zero on failure.
import { startServer, launch, openGame, flatWorldB64, STAND } from './harness.mjs';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
}

const { server, url } = await startServer();
const browser = await launch();
try {
  // 1. The game starts and shows the start wizard (no saved game)
  {
    const { page, errors } = await openGame(browser, url);
    const wizardShown = await page.$eval('#wiz', e => !e.classList.contains('hide')).catch(() => false);
    check('game starts and shows the start wizard', wizardShown);
    check('no uncaught errors on start', !errors.some(e => e.startsWith('pageerror')), errors.slice(0, 3).join(' | '));
    await page.close();
  }

  // 2. Settings panel shows the version and the change list
  {
    const saved = { v: 1, name: 'Test Hero', profile: { sex: 'x', race: 'x' }, worldId: 'TEST', inv: { dirt: 0, stone: 0, gem: 0, pick: 1, sword: 1 } };
    const { page } = await openGame(browser, url, { storage: saved });
    await page.click('#settingsBtn');
    await new Promise(r => setTimeout(r, 300));
    const shown = await page.$eval('#settings', e => getComputedStyle(e).display === 'block');
    check('Settings button opens the panel', shown);
    const text = await page.$eval('#settings', e => e.textContent);
    check('panel shows the game version 0.6.13', text.includes('Game version 0.6.13'));
    check('panel lists the 0.6.12 changes', text.includes('0.6.12') && text.includes('Drops when the bag is full'));
    await page.click('#settingsClose');
    await new Promise(r => setTimeout(r, 300));
    const hidden = await page.$eval('#settings', e => getComputedStyle(e).display === 'none');
    check('Close hides the panel', hidden);
    await page.close();
  }

  // 3. Full bag: digging drops the block on the ground, and the drop is saved.
  // The headless browser renders slowly (about 2-3 frames a second), so the test watches the saved game
  // (autosaves every 5 s) and waits up to 240 s for the dig to finish.
  {
    const saved = { v: 1, name: 'Test Hero', profile: { sex: 'x', race: 'x' }, worldId: 'TEST', inv: { dirt: 200, stone: 0, gem: 0, pick: 1, sword: 1 }, world: flatWorldB64(), pos: STAND };
    const { page } = await openGame(browser, url, { storage: saved });
    const readSave = () => page.evaluate(() => JSON.parse(localStorage.getItem('kidsgame.save.v1')));
    await new Promise(r => setTimeout(r, 20000)); // let the camera settle behind the character (frames are slow here)
    await page.mouse.move(240, 252); // a block just in front of the character, above the quick bar
    await page.mouse.down();
    const t0 = Date.now();
    let found = null;
    while (Date.now() - t0 < 240000) {
      await new Promise(r => setTimeout(r, 5000));
      const s = await readSave();
      if (Array.isArray(s.drops) && s.drops.length) { found = s; break; }
    }
    console.log('  (dig watch took ' + Math.round((Date.now() - t0) / 1000) + ' s, frame rate ' + (await page.evaluate(() => new Promise(res => { let n = 0; const t = performance.now(); (function f() { n++; if (performance.now() - t < 2000) requestAnimationFrame(f); else res((n / 2).toFixed(1)); })(); }))) + ' fps)');
    await page.mouse.up();
    check('digging with a full bag drops the block on the ground and saves it', !!found,
      found ? JSON.stringify(found.drops) : 'no drop after 240 s');
    globalThis.__dropSave = found;
    await page.close();
  }

  // 4. Walking onto a drop with room in the bag picks it up (watch the save)
  if (globalThis.__dropSave) {
    const [dx, dy, dz, did] = globalThis.__dropSave.drops[0];
    const saved = { ...globalThis.__dropSave, inv: { dirt: 0, stone: 0, gem: 0, pick: 1, sword: 1 }, pos: [dx + 0.5, dy, dz + 0.5] };
    const { page } = await openGame(browser, url, { storage: saved });
    const readSave = () => page.evaluate(() => JSON.parse(localStorage.getItem('kidsgame.save.v1')));
    let picked = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 90000) {
      await new Promise(r => setTimeout(r, 5000));
      const s = await readSave();
      if (!s.drops.length) { picked = s; break; }
    }
    check('standing on a drop with room picks it up', !!picked && (picked.inv[did] || 0) >= 1,
      picked ? did + ' in bag: ' + picked.inv[did] : 'drop still on the ground after 90 s');
    await page.close();
  } else {
    check('standing on a drop with room picks it up', false, 'skipped: no drop from the previous check');
  }
} catch (err) {
  check('test run finished without crashing', false, err.message);
} finally {
  await browser.close();
  server.close();
}
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
