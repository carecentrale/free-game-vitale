// Quiz Friends (0.6.63, SPEC-003): the rules for the questions, and the privacy rules of the feature.
// The question code is copied out of the game file at test time, so the tests run the real code. No browser needed.
// Run from the repository root:  node --test scripts/tests/quiz.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const game = fs.readFileSync(path.join(root, 'build', 'prototype-3d-v7.html'), 'utf8');

const start = game.indexOf('// ---- Quiz questions (0.6.63');
const mid = game.indexOf('// ---- Quiz Friends: the characters', start);
const end = game.indexOf('// ---- Game loop ----', mid);
if (start < 0 || mid < 0 || end < 0) throw new Error('quiz code markers not found in the game file');
const questionCode = game.slice(start, mid), friendCode = game.slice(mid, end);

const Q = vm.runInContext(questionCode + '\n;({ makeQuestion, nextQuestion, QUIZ_KINDS, QUIZ_REMEMBER, QUIZ_GEMS_FIRST, QUIZ_GEMS_LATER, QUIZ_HINT_AFTER, QUIZ_COUNT_SHAPES, QUIZ_PATTERN_SHAPES, quizRecent })',
  vm.createContext({ Math, Array, Object, String }));

// A steady stream of numbers, so a failing run can be repeated
function stream(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const sig = a => a.label !== undefined && a.label !== '' ? 'n' + a.label : 's' + a.shape;
const num = a => Number(a.label);
// Works out the right answer again, separately from the game's own sum
function rightAnswer(q) {
  if (q.kind === 'count') return 'n' + q.show[0].n;
  if (q.kind === 'add') return 'n' + (q.show[0].n + q.show[2].n);
  if (q.kind === 'take') { const m = q.text.match(/(\d+) − (\d+)/); return 'n' + (m[1] - m[2]); }
  if (q.kind === 'more') return 'n' + Math.max(...q.answers.map(num));
  const seq = q.show[0].seq;
  seq.forEach((s, i) => assert.equal(s, q.unit[i % q.unit.length], 'the pattern shown does not repeat its unit'));
  return 's' + q.unit[seq.length % q.unit.length];
}

test('there are five kinds of question: count, add, take away, which is more, what comes next', () => {
  assert.deepEqual([...Q.QUIZ_KINDS].sort(), ['add', 'count', 'more', 'next', 'take']);
});

test('every question has three different answers and exactly one is right', () => {
  for (const kind of Q.QUIZ_KINDS) {
    const rnd = stream(kind.length * 7919);
    for (let i = 0; i < 1500; i++) {
      const q = Q.makeQuestion(kind, rnd);
      assert.equal(q.kind, kind);
      assert.equal(q.answers.length, 3, q.key);
      const sigs = q.answers.map(sig);
      assert.equal(new Set(sigs).size, 3, 'answers are not all different: ' + q.key + ' ' + sigs);
      assert.ok(Number.isInteger(q.right) && q.right >= 0 && q.right < 3, q.key);
      const want = rightAnswer(q);
      assert.equal(sigs[q.right], want, 'the marked answer is not the right one: ' + q.key);
      assert.equal(sigs.filter(s => s === want).length, 1, 'more than one right answer: ' + q.key);
    }
  }
});

test('questions stay within 10: counting to 10, adding and taking away within 10', () => {
  const rnd = stream(42);
  const seen = { count: new Set(), add: new Set(), take: new Set() };
  for (let i = 0; i < 4000; i++) {
    for (const kind of ['count', 'add', 'take', 'more']) {
      const q = Q.makeQuestion(kind, rnd);
      for (const a of q.answers) assert.ok(num(a) >= 0 && num(a) <= 10, 'answer outside 0 to 10: ' + q.key);
      for (const n of q.text.match(/\d+/g) || []) assert.ok(+n >= 1 && +n <= 10, 'number outside 1 to 10 in: ' + q.text);
      for (const s of q.show) if (s.n !== undefined) assert.ok(s.n >= 1 && s.n <= 10, 'pictures outside 1 to 10: ' + q.key);
      if (seen[kind]) seen[kind].add(num(q.answers[q.right]));
    }
  }
  assert.equal(seen.count.size, 10, 'counting covers 1 to 10');
  assert.ok(seen.add.has(10) && seen.add.has(2), 'sums reach from 2 to 10');
  assert.ok(seen.take.has(1) && seen.take.has(9), 'taking away leaves from 1 to 9');
});

test('the wrong answers are close to the right one', () => {
  const rnd = stream(7);
  for (let i = 0; i < 3000; i++) {
    for (const kind of ['count', 'add', 'take', 'more']) {
      const q = Q.makeQuestion(kind, rnd), right = num(q.answers[q.right]);
      q.answers.forEach((a, k) => { if (k !== q.right) assert.ok(Math.abs(num(a) - right) <= 3 && num(a) !== right, 'wrong answer too far away: ' + q.key); });
    }
  }
});

test('the right answer is in a random place: left, middle and right all happen for every kind', () => {
  for (const kind of Q.QUIZ_KINDS) {
    const rnd = stream(99), places = [0, 0, 0];
    for (let i = 0; i < 600; i++) places[Q.makeQuestion(kind, rnd).right]++;
    for (const n of places) assert.ok(n > 120, kind + ': the right answer is not spread over the three places: ' + places);
  }
});

test('the question text is 8 words or fewer, not counting numbers and signs', () => {
  const rnd = stream(5);
  for (let i = 0; i < 2000; i++) {
    const q = Q.makeQuestion(Q.QUIZ_KINDS[i % 5], rnd);
    const words = q.text.split(/\s+/).filter(w => /[A-Za-z]/.test(w));
    assert.ok(words.length >= 2 && words.length <= 8, 'too many words: ' + q.text);
  }
});

test('"what comes next" uses two shapes, shows the pattern at least twice, and offers a third shape as a wrong answer', () => {
  const rnd = stream(11);
  for (let i = 0; i < 1000; i++) {
    const q = Q.makeQuestion('next', rnd), seq = q.show[0].seq;
    assert.equal(new Set(q.unit).size, 2, 'the pattern does not use two shapes');
    assert.ok(seq.length >= q.unit.length * 2, 'the pattern is not shown twice');
    assert.equal(q.answers.filter(a => !q.unit.includes(a.shape)).length, 1);
    for (const a of q.answers) assert.ok(Q.QUIZ_PATTERN_SHAPES.includes(a.shape));
  }
});

test('every question has a picture hint', () => {
  const rnd = stream(3);
  for (let i = 0; i < 500; i++) {
    const q = Q.makeQuestion(Q.QUIZ_KINDS[i % 5], rnd), h = q.hint;
    assert.ok(h && (Array.isArray(h.dots) || Array.isArray(h.rows) || Array.isArray(h.unit)), 'no hint: ' + q.key);
    if (q.kind === 'add') assert.equal(h.dots[0] + h.dots[1], num(q.answers[q.right]));
    if (q.kind === 'take') assert.equal(h.dots[0] - h.crossed, num(q.answers[q.right]));
    if (q.kind === 'count') assert.equal(h.dots[0], num(q.answers[q.right]));
  }
});

test('in 2,000 questions in a row, none repeats within the last 10', () => {
  const rnd = stream(2026), keys = [];
  for (let i = 0; i < 2000; i++) {
    const q = Q.nextQuestion(rnd);
    assert.ok(!keys.slice(-Q.QUIZ_REMEMBER).includes(q.key), 'question ' + i + ' repeats within 10: ' + q.key);
    keys.push(q.key);
  }
  assert.equal(new Set(keys.map(k => k.split(':')[0])).size, 5, 'all five kinds are asked');
  assert.ok(Q.quizRecent.length <= Q.QUIZ_REMEMBER, 'more than the last 10 questions are remembered');
});

test('rewards are fixed: 5 gems for a right first answer, 2 after a wrong try, and the hint comes after two wrong tries', () => {
  assert.equal(Q.QUIZ_GEMS_FIRST, 5);
  assert.equal(Q.QUIZ_GEMS_LATER, 2);
  assert.equal(Q.QUIZ_HINT_AFTER, 2);
  assert.ok(!/Math\.random|rnd\(/.test(friendCode.slice(friendCode.indexOf('function answerQuiz'), friendCode.indexOf('function setQuizOn'))), 'the reward must not be random');
});

test('nothing about questions or answers is stored, logged or sent; only the on/off switch is kept on the device', () => {
  const all = questionCode + friendCode;
  for (const word of ['logEvent', 'debugLog', 'logError', 'fetch(', 'XMLHttpRequest', 'sendBeacon', 'sb.', 'channel', 'shareBlock', 'sessionStorage', 'cookie', 'indexedDB'])
    assert.ok(!all.includes(word), 'the quiz code uses ' + word);
  const stored = [...all.matchAll(/localStorage\.(\w+)\(([^)]*)\)/g)].map(m => m[1] + ' ' + m[2]);
  assert.deepEqual(stored, ["getItem 'kidsgame.quiz'", "setItem 'kidsgame.quiz', quizOn ? '1' : '0'"]);
  // the saved game has no quiz fields either
  const save = game.slice(game.indexOf('function saveGame()'), game.indexOf('let worldLoaded'));
  assert.ok(!/quiz|friend/i.test(save), 'the saved game holds something about the quiz');
  // and a friend is not part of what is sent to a shared world
  const meta = game.slice(game.indexOf('function myMeta()'), game.indexOf('function onPresence()'));
  assert.ok(!/quiz|friend/i.test(meta), 'a friend is sent to the shared world');
});

test('tap only: the question panel has no place to type, no timer and no countdown', () => {
  assert.ok(!/<input|<textarea|contenteditable|keydown/i.test(friendCode), 'the quiz has a place to type');
  assert.ok(!/countdown|time left|seconds left|hurry|too late|missed/i.test(friendCode.replace(/\/\/.*$/gm, '')), 'the quiz mentions a timer or a missed chance');
  const panel = friendCode.slice(friendCode.indexOf('function openQuiz'), friendCode.indexOf('function showQuizHint'));
  assert.ok(panel.includes('Not now'), 'no "Not now" button');
  assert.ok(!/setTimeout|setInterval/.test(panel), 'the open question runs a timer');
});

test('there are three friends, an owl, a turtle and a robot, made in code with no model or picture files', () => {
  assert.match(friendCode, /const FRIEND_KINDS = \['owl', 'turtle', 'robot'\];/);
  assert.ok(!/loadModel|\.glb|\.png|\.jpg|https?:/.test(friendCode), 'a friend uses an outside file');
});

test('the friend rules are as written: 4 to 7 minutes apart, no monster within 10 blocks, stops 2 blocks away, 90 seconds, 40 blocks', () => {
  assert.match(friendCode, /const FRIEND_GAP = \[240, 420\];/);
  assert.match(friendCode, /const FRIEND_MONSTER_CLEAR = 10;/);
  assert.match(friendCode, /const FRIEND_STOP = 2;/);
  assert.match(friendCode, /const FRIEND_STAY = 90;/);
  assert.match(friendCode, /const FRIEND_FAR = 40;/);
});
