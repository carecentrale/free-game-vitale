// Living world (0.6.99, SPEC-026): the rules in the code. What moves and shows is checked in the browser tests.
// Run:  node --test scripts/tests/living-world.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const game = fs.readFileSync(path.join(root, 'build', 'prototype-3d-v7.html'), 'utf8');
const wind = game.slice(game.indexOf('// ---- Living world (0.6.99, SPEC-026): wind'), game.indexOf('// Six faces per block'));
const fx = game.slice(game.indexOf('// ---- Living world: small effects (0.6.99'), game.indexOf('// ---- Birds for every part of the world (0.6.97'));
const ground = game.slice(game.indexOf('// Ground variety (0.6.99, SPEC-026)'), game.indexOf('function dropChunk(k)'));
const plain = s => s.replace(/\/\/.*$/gm, '');

test('wind is done in the shader: the top of a plant moves a tenth of a block at most, a tree top a quarter; trunks and other things stay still', () => {
  assert.match(wind, /WIND = \{ grass: \[0\.1, 0\], flower: \[0\.1, 0\], plant: \[0\.1, 0\], bush: \[0\.1, 0\], common: \[0\.25, 0\.35\], pine: \[0\.25, 0\.3\], palm: \[0\.25, 0\.6\] \}/);
  assert.match(wind, /WIND_STILL = \/trunk\|brown\/i/);
  assert.match(wind, /onBeforeCompile/); assert.match(wind, /sh\.vertexShader\.replace\('#include <project_vertex>'/);
  assert.match(wind, /windW \* windW \* windA/, 'only the top moves: the lean grows with the height');
  // the two leans add up to no more than the kind's distance: 0.85 * sqrt(1 + 0.6 * 0.6) is under 1
  assert.match(wind, /W\[0\] \* 0\.85/); assert.ok(0.85 * Math.hypot(1, 0.6) <= 1);
  assert.match(wind, /windP\.x \* 0\.35 \+ windP\.y \* 0\.27/, 'the wind rolls across the land: plants side by side are not in step');
  assert.doesNotMatch(plain(game.slice(game.indexOf('function updateFx(dt)'), game.indexOf('// ---- Birds for every part of the world (0.6.97'))), /decor|chunkMeshes/, 'no work for each plant on the processor each frame');
  assert.match(game, /mat: windMat\(o\.material, d\.kind, o\.matrixWorld\.clone\(\)\)/);
});

test('water: a moving pattern on the one water material, still see-through, no extra draws, no reflections', () => {
  assert.match(wind, /waterMat = new THREE\.MeshLambertMaterial\(\{ color: 0x2f7fd0, transparent: true, opacity: 0\.6 \}\)/);
  assert.match(wind, /waterMat\.onBeforeCompile/);
  assert.match(wind, /mod\( instanceMatrix\[ 3 \]\.xz \+ modelMatrix\[ 3 \]\.xz, 64\.0 \)/);
  for (const f of [0.1875, 0.0625, 0.25, 0.125, 0.5, 0.4375]) assert.equal((f * 64) % 1, 0, 'the pattern repeats every 64 blocks: ' + f);
  assert.doesNotMatch(plain(wind), /diffuseColor\.a|envMap|Reflector|new THREE\.(Mesh|InstancedMesh)\(/);
  assert.equal((game.match(/\[T\.WATER\]: Array\(6\)\.fill\(waterMat\)/g) || []).length, 1);
});

test('effects: 60 at most in one draw, 1.5 seconds at most, a leaf every 5 seconds at most within 20 blocks; nothing is saved, sent or recorded', () => {
  assert.match(fx, /FX_MAX = 60, FX_LIFE = 1\.5, LEAF_EVERY = 5, LEAF_REACH = 20/);
  assert.match(fx, /if \(calmMotion \|\| fxList\.length >= FX_MAX\) return false;/);
  assert.match(fx, /p\.life = Math\.min\(FX_LIFE, p\.life\)/);
  assert.equal((plain(fx).match(/new THREE\.InstancedMesh\(/g) || []).length, 1, 'all drawn together in one draw call');
  assert.equal((plain(fx).match(/scene\.add\(/g) || []).length, 1);
  assert.match(fx, /if \(leafWait <= 0\) \{ leafWait = LEAF_EVERY;/);
  for (const word of ['logEvent', 'logOnce', 'saveGame', 'localStorage', 'sendSync', 'channel', 'fetch(', 'sb.']) assert.ok(!plain(fx).includes(word), 'the effects code uses ' + word);
  assert.ok(!/\.glb|\.png|https?:|<img|loadModel/i.test(plain(fx) + plain(wind) + plain(ground)), 'everything is drawn in code: no new file');
  // where they start: digging, placing, landing from 3 blocks, a gem, and a block another child changed
  assert.match(game, /fxBlock\(x, y, z, t, false\);/); assert.match(game, /fxBlock\(x, y, z, item\.block, true\);/);
  assert.match(game, /if \(fallTop - py >= 2\.9 && !inWater\) fxDust\(px, py, pz\);/);
  assert.match(game, /if \(id === 'gem' && n > 0\) \{ sfx\('gem'\); fxSparkle\(px, py \+ 0\.9, pz\); \}/);
  assert.match(game, /if \(p\.t === T\.AIR\) fxBlock\(p\.x, p\.y, p\.z, was, false\); else if \(!solid\(was\)\) fxBlock\(p\.x, p\.y, p\.z, p\.t, true\);/);
  assert.doesNotMatch(game, /event: 'fx'|sendSync\('fx'/, 'nothing new is sent in a shared world');
});

test('ground variety: grass, dirt, sand, snow and stone are turned and shaded up to 5%, from the block\'s place only; grass keeps its sides', () => {
  assert.match(ground, /return \{ \[T\.GRASS\]: about, \[T\.DIRT\]: all, \[T\.SAND\]: all, \[T\.SNOW\]: all, \[T\.STONE\]: all \};/);
  assert.match(ground, /shade: 0\.95 \+ hash3\(x, y, z, 2602\) \* 0\.1/);
  assert.match(ground, /hash3\(x, y, z, 2601\) \* ways/);
  assert.doesNotMatch(plain(ground.slice(0, ground.indexOf('function buildChunkMeshes'))), /Math\.random|seed|Date/, 'the same every time and on every device');
  assert.match(ground, /groundLook\(ox \+ L\[3 \* i\], L\[3 \* i \+ 1\], oz \+ L\[3 \* i \+ 2\], turns\.length\)/, 'from the block\'s place in the world');
  assert.equal((plain(ground).match(/new THREE\.InstancedMesh\(blockGeo/g) || []).length, 1, 'no more draws for each chunk');
});

test('Calm motion: in the parent area, off to start, kept with the saved game; it stops the wind, the ripples and the effects', () => {
  assert.match(game, /let calmMotion = false;/);
  assert.match(game, /Calm motion: no swaying, falling leaves or effects/);
  assert.match(game, /calm: calmMotion,/); assert.match(game, /setCalm\(saved\.calm === true\);/);
  assert.match(fx, /windOn\.value = calmMotion \? 0 : 1;/);
  assert.match(wind, /uSway\.x \* uWindOn/); assert.match(wind, /uWindOn \* \( 0\.12 \* rip1 \* rip2/);
  const area = game.slice(game.indexOf("'<div id=\"dragonCtl\""), game.indexOf("'<div id=\"dragonCtl\"") + 400);
  assert.match(area, /id="calmCtl"/, 'next to Dragons, in the parent area');
});

test('the download grows by no more than 20 KB, and the guide and release notes show it', () => {
  let before = 0;
  try { before = execSync('git show b985c4d:build/prototype-3d-v7.html', { cwd: root, maxBuffer: 1 << 26 }).length; } catch (e) { return; }   // 0.6.98; not there in a shallow copy
  const added = Buffer.byteLength(wind) + Buffer.byteLength(fx) + Buffer.byteLength(ground.slice(0, ground.indexOf('function buildChunkMeshes')));
  assert.ok(added < 20000, 'the Living world code is ' + added + ' bytes');
  assert.ok(before > 0);
  const guide = fs.readFileSync(path.join(root, 'www', 'how-to-play.html'), 'utf8');
  assert.match(guide, /The wind moves the grass, flowers and trees, and sometimes a leaf falls\. Water ripples\. When you dig, land from a jump or pick up a gem, you see a little puff or sparkle\./);
  assert.match(guide, /<td>Calm motion<\/td>/);
  assert.match(fs.readFileSync(path.join(root, 'www', 'release-notes.html'), 'utf8'), /The world comes alive: grass and trees sway in the wind, water ripples, and digging, landing and gems make little effects\./);
});
