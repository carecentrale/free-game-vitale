// The stop-after-N test runner (scripts/test-stop-after.mjs): it counts and names failed tests and stops at its limit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { failedNames, shouldStop, namePattern, parseLimit, DEFAULT_LIMIT } from '../test-stop-after.mjs';

const tap = [
  'TAP version 13',
  '# Subtest: first test',
  'ok 1 - first test',
  '# Subtest: a broken one',
  '    not ok 1 - nested step (not a top-level failure)',
  'not ok 2 - a broken one',
  'ok 3 - fine',
  "not ok 4 - the Spell button (\"fire\") + more",
  '1..4',
].join('\n');

test('failedNames lists only the top-level failed tests, in order', () => {
  assert.deepEqual(failedNames(tap), ['a broken one', 'the Spell button ("fire") + more']);
});

test('failedNames is empty for a passing run', () => {
  assert.deepEqual(failedNames('ok 1 - a\nok 2 - b\n1..2'), []);
});

test('shouldStop stops exactly at the limit', () => {
  assert.equal(shouldStop(2, 3), false);
  assert.equal(shouldStop(3, 3), true);
  assert.equal(shouldStop(4, 3), true);
});

test('the default limit is 3 failures', () => {
  assert.equal(DEFAULT_LIMIT, 3);
  assert.equal(parseLimit(undefined), 3);
  assert.equal(parseLimit('1'), 1);
});

test('a bad limit is refused', () => {
  assert.throws(() => parseLimit('0'));
  assert.throws(() => parseLimit('two'));
  assert.throws(() => parseLimit('1.5'));
});

test('namePattern matches exactly the given names, with special characters escaped', () => {
  const re = new RegExp(namePattern(['a (b)', 'c.d']));
  assert.ok(re.test('a (b)'));
  assert.ok(re.test('c.d'));
  assert.ok(!re.test('cxd'));
  assert.ok(!re.test('a (b) more'));
});
