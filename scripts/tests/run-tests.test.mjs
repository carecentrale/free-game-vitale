// Tests for scripts/run-tests.mjs: when the build reruns failed browser tests, and when it stops at once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJunit, decide, isBrowserTest, namePattern, MAX_RETRY } from '../run-tests.mjs';

const src = "test('a fireball flies', () => {});\ntest('the bag\\'s grid', () => {});\ntest('jump (extra), once', () => {});\n";
const junit = cases => '<testsuites>' + cases.map(([n, f]) => `<testcase name="${n}" time="1"${f ? ' failure="x"><failure/></testcase>' : '/>'}`).join('') + '</testsuites>';

test('the JUnit report is read: names (with escaped characters) and which ones failed', () => {
  const c = parseJunit(junit([['a fireball flies', false], ['the bag&apos;s grid', true], ['x &amp; y &quot;z&quot;', false]]));
  assert.deepEqual(c, [{ name: 'a fireball flies', failed: false }, { name: "the bag's grid", failed: true }, { name: 'x & y "z"', failed: false }]);
});

test('a few failed browser tests are rerun once; anything else stops the build', () => {
  assert.equal(isBrowserTest("the bag's grid", src), true);
  assert.equal(isBrowserTest('the world is wide', src), false);
  assert.equal(decide(0, [{ name: 'a fireball flies', failed: false }], src).action, 'ok');
  assert.deepEqual(decide(1, [{ name: 'a fireball flies', failed: true }, { name: 'jump (extra), once', failed: false }], src), { action: 'retry', failed: ['a fireball flies'] });
  assert.equal(decide(1, [{ name: 'the world is wide', failed: true }], src).action, 'fail', 'a non-browser test is never rerun');
  assert.equal(decide(1, [{ name: 'a fireball flies', failed: true }, { name: 'the world is wide', failed: true }], src).action, 'fail');
  const many = Array.from({ length: MAX_RETRY + 1 }, () => ({ name: 'a fireball flies', failed: true }));
  assert.equal(decide(1, many, src).action, 'fail', 'too many failures are not rerun');
  assert.equal(decide(1, [], src).action, 'fail', 'a crash without a list of failures is not rerun');
});

test('the rerun pattern matches exactly the failed names, with special characters', () => {
  const re = new RegExp(namePattern(['jump (extra), once', 'a fireball flies']));
  assert.ok(re.test('jump (extra), once') && re.test('a fireball flies'));
  assert.ok(!re.test('a fireball flies far') && !re.test('jump extra, once'));
});
