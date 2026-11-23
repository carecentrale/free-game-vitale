// Block textures: far-away walls must not shimmer or blink (castle flicker fix, 0.6.82).
// Up close blocks keep sharp pixels; far away they use mipmaps; anisotropy is set once the renderer exists.
// Run from the repository root:  node --test scripts/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const game = fs.readFileSync(path.join(root, 'build/prototype-3d-v7.html'), 'utf8');
const makeTex = game.match(/function makeTex\(draw\) \{[\s\S]*?\n\}/)?.[0] ?? '';

test('makeTex is found in the game', () => {
  assert.ok(makeTex.length > 0);
});

test('block textures keep sharp pixels up close', () => {
  assert.match(makeTex, /magFilter = THREE\.NearestFilter/);
});

test('block textures use mipmaps far away, so detailed walls do not flicker', () => {
  assert.match(makeTex, /minFilter = THREE\.LinearMipmapLinearFilter/);
  assert.match(makeTex, /generateMipmaps = true/);
  assert.doesNotMatch(makeTex, /minFilter = THREE\.NearestFilter/);
});

test('block textures are a power-of-two size (mipmaps need it on older devices)', () => {
  const S = Number(makeTex.match(/const S = (\d+)/)?.[1]);
  assert.ok(S > 0 && (S & (S - 1)) === 0, `size ${S}`);
});

test('every block texture is listed and gets anisotropy after the renderer is made', () => {
  assert.match(makeTex, /blockTextures\.push\(t\)/);
  const rendererAt = game.indexOf('new THREE.WebGLRenderer(');
  const anisoAt = game.indexOf('getMaxAnisotropy()');
  assert.ok(rendererAt > 0 && anisoAt > rendererAt, 'anisotropy is set after the renderer exists');
  assert.match(game, /Math\.min\(4, renderer\.capabilities\.getMaxAnisotropy\(\)/);
});

test('no texture elsewhere in the game turns minification back to nearest', () => {
  assert.equal((game.match(/minFilter = THREE\.NearestFilter/g) || []).length, 0);
});
