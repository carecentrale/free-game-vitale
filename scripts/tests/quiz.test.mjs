// Quiz Friends (0.6.63, SPEC-003; word scrambles and the quiz report, 0.6.65): the rules for the questions, and the privacy rules of the feature.
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

const Q = vm.runInContext(questionCode + '\n;({ makeQuestion, nextQuestion, QUIZ_KINDS, QUIZ_REMEMBER, QUIZ_GEMS_FIRST, QUIZ_GEMS_LATER, QUIZ_HINT_AFTER, QUIZ_COUNT_SHAPES, QUIZ_PATTERN_SHAPES, quizRecent, QUIZ_MATH_KINDS, QUIZ_WORDS, QUIZ_WORD_ROWS, QUIZ_MATH_ROWS, QUIZ_BANDS, quizLevelsBlank, quizLevelsFrom, quizFirstAnswer, quizSetBand, quizSetLevel, quizLevelsRestart, quizRowOf, levels: () => quizLevels, setLevels: v => { quizLevels = v; }, quizSubject, quizBlank, quizStatsFrom, quizCount, stats: () => quizStats, setStats: v => { quizStats = v; } })',
  vm.createContext({ Math, Array, Object, String, Number, Set }));

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

test('there are five kinds of maths question (count, add, take away, which is more, what comes next) and the word scramble', () => {
  assert.deepEqual([...Q.QUIZ_MATH_KINDS].sort(), ['add', 'count', 'more', 'next', 'take']);
  assert.deepEqual([...Q.QUIZ_KINDS].sort(), ['add', 'count', 'more', 'next', 'take', 'word']);
  assert.equal(Q.quizSubject('word'), 'words');
  for (const k of Q.QUIZ_MATH_KINDS) assert.equal(Q.quizSubject(k), 'math');
});

test('every maths question has three different answers and exactly one is right', () => {
  for (const kind of Q.QUIZ_MATH_KINDS) {
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
  for (const kind of Q.QUIZ_MATH_KINDS) {
    const rnd = stream(99), places = [0, 0, 0];
    for (let i = 0; i < 600; i++) places[Q.makeQuestion(kind, rnd).right]++;
    for (const n of places) assert.ok(n > 120, kind + ': the right answer is not spread over the three places: ' + places);
  }
});

test('the question text is 8 words or fewer, not counting numbers and signs', () => {
  const rnd = stream(5);
  for (let i = 0; i < 2000; i++) {
    const q = Q.makeQuestion(Q.QUIZ_KINDS[i % 6], rnd);
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
    const q = Q.makeQuestion(Q.QUIZ_KINDS[i % 6], rnd), h = q.hint;
    assert.ok(h && (Array.isArray(h.dots) || Array.isArray(h.rows) || Array.isArray(h.unit) || h.first === q.word[0]), 'no hint: ' + q.key);
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
  const kinds = keys.map(k => k.split(':')[0]);
  assert.equal(new Set(kinds).size, 6, 'all six kinds are asked');
  const words = kinds.filter(k => k === 'word').length;
  assert.ok(words > 850 && words < 1150, 'about half the questions are word scrambles: ' + words);
  assert.ok(Q.quizRecent.length <= Q.QUIZ_REMEMBER, 'more than the last 10 questions are remembered');
});

test('rewards are fixed: 5 gems for a right first answer, 2 after a wrong try, and the hint comes after two wrong tries', () => {
  assert.equal(Q.QUIZ_GEMS_FIRST, 5);
  assert.equal(Q.QUIZ_GEMS_LATER, 2);
  assert.equal(Q.QUIZ_HINT_AFTER, 2);
  assert.ok(!/Math\.random|rnd\(/.test(friendCode.slice(friendCode.indexOf('function answerQuiz'), friendCode.indexOf('function setQuizOn'))), 'the reward must not be random');
});

test('no question or answer is stored, logged or sent; the device keeps only the on/off switch and the counts of the quiz report', () => {
  const all = questionCode + friendCode;
  for (const word of ['logEvent', 'debugLog', 'logError', 'fetch(', 'XMLHttpRequest', 'sendBeacon', 'sb.', 'channel', 'shareBlock', 'sessionStorage', 'document.cookie', 'indexedDB'])
    assert.ok(!all.includes(word), 'the quiz code uses ' + word);
  const stored = [...all.matchAll(/localStorage\.(\w+)\(([^)]*)\)/g)].map(m => m[1] + ' ' + m[2]);
  assert.deepEqual(stored, ["getItem 'kidsgame.quiz'", "setItem 'kidsgame.quiz', quizOn ? '1' : '0'"]);
  // the saved game holds the counts of the quiz report (0.6.65) and nothing else about the quiz
  const save = game.slice(game.indexOf('function saveGame()'), game.indexOf('let worldLoaded'));
  assert.deepEqual(save.match(/\b\w*(?:quiz|friend)\w*/gi), ['quiz', 'quizStats', 'quizLevels'], 'the saved game holds more about the quiz than the counts and the learning levels (0.6.72)');
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
  // 0.6.67 (the parent's decision): one from the start, and a minute of moving about after a right answer
  assert.match(friendCode, /const FRIEND_FIRST = 3;/);
  assert.match(friendCode, /const FRIEND_AFTER_SOLVE = 60;/);
  assert.match(friendCode, /const FRIEND_MONSTER_CLEAR = 10;/);
  assert.match(friendCode, /const FRIEND_STOP = 2;/);
  assert.match(friendCode, /const FRIEND_STAY = 90;/);
  assert.match(friendCode, /const FRIEND_FAR = 40;/);
});

// ---- Word scramble (0.6.65; 291 words in ten rows from 0.6.72, SPEC-004) ----
const EXCEPTIONS = ['sun', 'bed', 'pig', 'tree', 'book', 'boat', 'king', 'apple', 'mouse', 'train', 'zebra'];   // kept by the owner, 18 Nov 2026
const picDir = path.join(root, 'www', 'quiz', 'pics');

test('a word scramble shows the letters of one word of its level, mixed up, with its first letter as the hint; every word is used', () => {
  const rnd = stream(77), seen = new Set();
  for (let level = 1; level <= 100; level++) for (let i = 0; i < 400; i++) {
    const q = Q.makeQuestion('word', rnd, level, 1);
    const entry = Q.QUIZ_WORDS.find(([w]) => w.toUpperCase() === q.word);
    assert.ok(entry, 'the word is not in the list: ' + q.word);
    assert.equal(q.clue, entry[1]);
    assert.equal(q.key, 'word:' + entry[0]);
    assert.equal(q.text, 'Spell the word');
    assert.deepEqual([...q.letters].sort(), q.word.split('').sort(), 'the tiles are not the letters of the word');
    assert.notEqual(q.letters.join(''), q.word, 'the letters are already in order: ' + q.word);
    assert.equal(q.hint.first, q.word[0], 'the first-letter help is missing at ' + q.word.length + ' letters');
    seen.add(q.word);
  }
  assert.equal(seen.size, Q.QUIZ_WORDS.length, 'every word in the list is used');
});

test('a word comes from the row of the words level, and about one time in four from the row below when the parent allows it', () => {
  const rnd = stream(404);
  const rowOf = q => Math.floor((Q.QUIZ_WORDS.find(([w]) => w.toUpperCase() === q.word)[2] - 1) / 10);
  for (const level of [1, 10]) for (let i = 0; i < 300; i++) assert.equal(rowOf(Q.makeQuestion('word', rnd, level, 1)), 0);
  for (const level of [11, 45, 100]) {
    const row = Math.floor((level - 1) / 10);
    let below = 0;
    for (let i = 0; i < 2000; i++) { const r = rowOf(Q.makeQuestion('word', rnd, level, 1)); assert.ok(r === row || r === row - 1, 'level ' + level + ' gave a word of row ' + r); if (r < row) below++; }
    assert.ok(below > 400 && below < 600, 'the row below is not used one time in four at level ' + level + ': ' + below);
  }
  // a band starting at 41: the row below level 41 is outside it, so it is never used; at 51 it is inside
  for (let i = 0; i < 500; i++) assert.equal(rowOf(Q.makeQuestion('word', rnd, 41, 41)), 4);
  let below = 0;
  for (let i = 0; i < 500; i++) if (rowOf(Q.makeQuestion('word', rnd, 51, 41)) === 4) below++;
  assert.ok(below > 70, 'a row inside the band is not used');
});

test('there are 291 words in ten rows: 3 letters at levels 1 to 10, rising to 8 letters at 91 to 100', () => {
  const sizes = [28, 21, 20, 28, 27, 34, 33, 28, 27, 45], letters = [3, 4, 4, 5, 5, 6, 6, 7, 7, 8];
  assert.equal(Q.QUIZ_WORD_ROWS.length, 10);
  Q.QUIZ_WORD_ROWS.forEach((row, r) => {
    assert.equal(row.length, sizes[r], 'row ' + r);
    for (const [w] of row) assert.equal(w.length, letters[r], w + ' is in the wrong row');
  });
  const words = Q.QUIZ_WORDS.map(([w]) => w);
  assert.equal(words.length, 291);
  assert.equal(new Set(words).size, words.length, 'a word is listed twice');
  for (const [w, , from, to] of Q.QUIZ_WORDS) { assert.match(w, /^[a-z]{3,8}$/, 'not a plain word: ' + w); assert.equal(to - from, 9); assert.equal((from - 1) % 10, 0); }
  // "Levels 1 to 20" never gives more than 4 letters; "Levels 81 to 100" gives 7 or 8
  for (const [w, , from] of Q.QUIZ_WORDS) { if (from <= 20) assert.ok(w.length <= 4, w); if (from >= 81) assert.ok(w.length >= 7, w); }
});

test('words of 3 to 5 letters have a picture file shipped with the game, words of 6 letters or more have none, and no two words share a picture', () => {
  const pics = [];
  for (const [w, pic] of Q.QUIZ_WORDS) {
    if (w.length >= 6) { assert.equal(pic, null, w + ' has 6 letters or more and a picture'); continue; }
    assert.match(String(pic), /^[0-9a-f-]+$/, w + ' has no picture');
    const file = path.join(picDir, pic + '.svg');
    assert.ok(fs.existsSync(file), 'the picture file for ' + w + ' is missing: www/quiz/pics/' + pic + '.svg');
    const svg = fs.readFileSync(file, 'utf8');
    assert.ok(svg.startsWith('<svg') && !/<script|href=|https?:\/\/(?!www\.w3\.org)/i.test(svg), 'the picture for ' + w + ' is not a plain drawing');
    pics.push(pic);
  }
  assert.equal(pics.length, 124);
  assert.equal(new Set(pics).size, pics.length, 'two words share a picture');
  // nothing else is in the folder, and the folder stays small
  const files = fs.readdirSync(picDir);
  assert.deepEqual(files.slice().sort(), pics.map(p => p + '.svg').sort(), 'www/quiz/pics/ holds a file no word uses');
  assert.ok(files.reduce((n, f) => n + fs.statSync(path.join(picDir, f)).size, 0) < 300000, 'the pictures are larger than 300 KB in total');
  // the pictures come from the shipped files, never from the device's own emoji font
  const panel = friendCode.slice(friendCode.indexOf('const QUIZ_PIC_BASE'), friendCode.indexOf('function showQuizHint'));
  assert.match(panel, /<img src="\$\{QUIZ_PIC_BASE\}\$\{q\.clue\}\.svg"/);
  assert.ok(!/[☀-➿]|\\u26|\\uD83/.test(questionCode), 'the question code still holds emoji characters');
});

test('every word is in ENABLE, no other ENABLE word has the same letters (the eleven named exceptions aside), and none is a rude word', () => {
  const file = path.join(root, 'scripts', 'tests', 'data', 'enable1.txt');
  const enable = fs.readFileSync(file, 'utf8').split(/\s+/).filter(Boolean);
  assert.equal(enable.length, 172823, 'this is not the ENABLE list (enable1.txt, 172,823 words)');
  const set = new Set(enable), same = new Map();
  for (const w of enable) { const k = w.split('').sort().join(''); same.set(k, (same.get(k) || 0) + 1); }
  // Rude words a child must never be asked to spell. The list stays here, in the tests: it must not travel inside a children's game.
  const rude = ['ass', 'arse', 'bum', 'bums', 'butt', 'poo', 'poop', 'pee', 'wee', 'fart', 'crap', 'damn', 'hell', 'sex', 'sexy', 'tit', 'tits', 'boob', 'dick', 'cock', 'cum', 'fuck', 'shit', 'piss', 'slut', 'whore', 'bitch', 'porn', 'anus', 'penis', 'nazi', 'kill', 'die', 'dead', 'gun', 'drug', 'hate', 'dumb', 'fat', 'ugly', 'idiot', 'wank', 'twat', 'cunt', 'fag', 'homo', 'rape', 'turd', 'puke', 'snot', 'scum', 'jerk', 'suck', 'sucks', 'butts', 'pube', 'nude', 'gay'];
  // Spelled differently in the United States and in Canada: never used
  const twoSpellings = ['color', 'colour', 'gray', 'grey', 'pajamas', 'pyjamas', 'favor', 'honor', 'center', 'centre', 'theater', 'theatre', 'meter', 'metre', 'liter', 'litre', 'fiber', 'fibre', 'flavor', 'harbor', 'humor', 'labor', 'neighbor', 'rumor', 'jewelry', 'traveler', 'cheque', 'check', 'tire', 'tyre', 'plow', 'mold', 'mom', 'mum', 'yogurt', 'donut', 'doughnut', 'catalog', 'program', 'practice', 'license', 'defense', 'offense', 'aluminum', 'mustache', 'omelet', 'omelette', 'sulfur'];
  const failing = [];
  for (const [w] of Q.QUIZ_WORDS) {
    assert.ok(set.has(w), w + ' is not in ENABLE');
    assert.ok(!rude.includes(w), w + ' is on the rude-word list');
    assert.ok(!twoSpellings.includes(w), w + ' is spelled differently in the United States and Canada');
    if (same.get(w.split('').sort().join('')) > 1) failing.push(w);
  }
  assert.deepEqual(failing.sort(), [...EXCEPTIONS].sort(), 'words that share their letters with another ENABLE word');
});

test('the ENABLE list and the rude-word list are used by the tests only: neither is in the game or in the website folder', () => {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  for (const f of walk(path.join(root, 'www'))) assert.ok(!/enable/i.test(path.basename(f)) && fs.statSync(f).size !== 1743363, 'the ENABLE list is in the website folder: ' + f);
  assert.ok(!/enable1|const rude\b/.test(game), 'the game file names the ENABLE list or holds a rude-word list');
});

// ---- Quiz report (0.6.65) ----
test('the quiz report starts empty and counts questions seen, right first time and right after a retry, for maths and for words', () => {
  Q.setStats(Q.quizBlank());
  assert.deepEqual(JSON.parse(JSON.stringify(Q.stats())), { math: { opened: 0, first: 0, later: 0, hints: 0, swaps: 0 }, words: { opened: 0, first: 0, later: 0, hints: 0, swaps: 0 }, since: null, last: null });
  const day1 = new Date(2026, 10, 17, 9, 0), day2 = new Date(2026, 10, 19, 23, 30);
  Q.quizCount('math', 'opened', day1); Q.quizCount('math', 'first', day1);
  Q.quizCount('words', 'opened', day1);
  Q.quizCount('words', 'opened', day2); Q.quizCount('words', 'later', day2);
  assert.deepEqual(JSON.parse(JSON.stringify(Q.stats())), { math: { opened: 1, first: 1, later: 0, hints: 0, swaps: 0 }, words: { opened: 2, first: 0, later: 1, hints: 0, swaps: 0 }, since: '2026-11-17', last: '2026-11-19' });
  // 0.6.75 (SPEC-016 part D): hints used and questions swapped are counted too
  Q.quizCount('math', 'hints', day2); Q.quizCount('words', 'swaps', day2); Q.quizCount('words', 'swaps', day2);
  assert.deepEqual([Q.stats().math.hints, Q.stats().math.swaps, Q.stats().words.hints, Q.stats().words.swaps], [1, 0, 0, 2]);
});

test('the quiz report read from a saved game keeps only whole numbers and dates', () => {
  const clean = v => JSON.parse(JSON.stringify(Q.quizStatsFrom(v)));
  const blank = JSON.parse(JSON.stringify(Q.quizBlank()));
  for (const bad of [undefined, null, 'x', 7, []]) assert.deepEqual(clean(bad), blank);
  assert.deepEqual(clean({ math: { opened: 3, first: 2, later: 1, extra: 'How many stars?' }, words: { opened: -1, first: 1.5, later: '2' }, since: '2026-11-17', last: '<b>', answers: ['7'] }),
    { math: { opened: 3, first: 2, later: 1, hints: 0, swaps: 0 }, words: { opened: 0, first: 0, later: 0, hints: 0, swaps: 0 }, since: '2026-11-17', last: null });
  // a save from before 0.6.75 has no hints or swaps: they read as 0; the new counts are kept as whole numbers only
  assert.deepEqual(clean({ math: { opened: 2, first: 1, later: 0, hints: 3, swaps: 'x' }, words: { hints: 1.5, swaps: 2 } }).math, { opened: 2, first: 1, later: 0, hints: 3, swaps: 0 });
  assert.deepEqual(clean({ words: { hints: 1.5, swaps: 2 } }).words, { opened: 0, first: 0, later: 0, hints: 0, swaps: 2 });
});

test('the quiz report holds counts and two dates only: no question, no answer, no name', () => {
  const report = questionCode.slice(questionCode.indexOf('// ---- Quiz report')).replace(/\/\/.*$/gm, '');
  assert.deepEqual(Object.keys(Q.quizBlank()).sort(), ['last', 'math', 'since', 'words']);
  assert.ok(!/q\.text|q\.key|answers|playerName|worldId|pid\b/.test(report), 'the report code touches a question, an answer or a name');
  // counted in five places only (and the function itself): a question shown, a right answer, and since 0.6.75 a hint,
  // a swap and the question shown by the swap
  assert.equal((game.match(/quizCount\(/g) || []).length, 6);
});

// ---- Learning level (0.6.72, SPEC-004) ----
const lv = () => JSON.parse(JSON.stringify(Q.levels()));
const fresh = () => Q.setLevels(Q.quizLevelsBlank());

test('both levels start at 1 on Auto; three right first answers in maths give Maths level 16 and leave Words at level 1', () => {
  fresh();
  assert.deepEqual(lv(), { band: 0, math: { use: 1, best: 1, fast: true, right: 0, wrong: 0 }, words: { use: 1, best: 1, fast: true, right: 0, wrong: 0 } });
  assert.deepEqual([1, 2, 3].map(() => Q.quizFirstAnswer('math', true)), [6, 11, 16], 'a right first answer does not report the new level');
  assert.equal(lv().math.best, 16);
  assert.equal(lv().math.use, 16);
  assert.deepEqual(lv().words, { use: 1, best: 1, fast: true, right: 0, wrong: 0 }, 'maths answers moved the words level');
});

test('the fast start ends at the first wrong first answer in that subject; after it a right first answer moves the level up 1', () => {
  fresh();
  Q.quizFirstAnswer('math', true);
  Q.quizFirstAnswer('math', false);
  assert.equal(lv().math.fast, false);
  assert.equal(Q.quizFirstAnswer('math', true), 7);
  assert.equal(lv().words.fast, true, 'a wrong maths answer ended the fast start for words');
  assert.equal(Q.quizFirstAnswer('words', true), 6);
});

test('two wrong first answers in a row move the level in use down 3, never below 1 or the band; the number the child sees does not go down', () => {
  fresh();
  for (let i = 0; i < 4; i++) Q.quizFirstAnswer('math', true);   // 21
  assert.equal(Q.quizFirstAnswer('math', false), 0);
  assert.equal(lv().math.use, 21, 'one wrong answer moved the level');
  Q.quizFirstAnswer('math', false);
  assert.deepEqual([lv().math.use, lv().math.best], [18, 21]);
  // a right answer in between starts the count again
  Q.quizFirstAnswer('math', false); Q.quizFirstAnswer('math', true); Q.quizFirstAnswer('math', false);
  assert.equal(lv().math.use, 19);
  assert.equal(Q.quizFirstAnswer('math', true), 0, '"Level up" was shown below the best level');
  assert.equal(lv().math.best, 21);
  // never below 1
  fresh();
  for (let i = 0; i < 6; i++) Q.quizFirstAnswer('words', false);
  assert.deepEqual([lv().words.use, lv().words.best], [1, 1]);
  // never below the band
  Q.quizSetBand(3);
  for (let i = 0; i < 6; i++) Q.quizFirstAnswer('words', false);
  assert.equal(lv().words.use, 41);
});

test('the levels stop at 100, and at the top of the band', () => {
  fresh();
  for (let i = 0; i < 40; i++) Q.quizFirstAnswer('math', true);
  assert.deepEqual([lv().math.use, lv().math.best], [100, 100]);
  fresh(); Q.quizSetBand(1);
  for (let i = 0; i < 40; i++) Q.quizFirstAnswer('math', true);
  assert.deepEqual([lv().math.use, lv().math.best], [20, 20]);
});

test('Auto and five bands of 20 levels; a band brings both levels inside it, and Auto opens all 100 again', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(Q.QUIZ_BANDS)), [[1, 100], [1, 20], [21, 40], [41, 60], [61, 80], [81, 100]]);
  fresh();
  Q.quizSetLevel('math', 70);
  Q.quizSetBand(2);   // 21 to 40: maths comes down to 40, words start at 21
  assert.deepEqual([lv().band, lv().math.use, lv().math.best, lv().words.use, lv().words.best], [2, 40, 40, 21, 21]);
  Q.quizSetBand(0);
  assert.deepEqual([lv().band, lv().math.use, lv().words.use], [0, 40, 21], 'Auto changed the levels');
  for (let i = 0; i < 70; i++) Q.quizFirstAnswer('math', true);
  assert.equal(lv().math.use, 100, 'on Auto the level does not move across all 100');
  for (const bad of [-1, 6, 1.5, '2', null]) { Q.quizSetBand(bad); assert.equal(lv().band, 0); }
});

test('the parent sets a level to any whole number inside the band: it is the level in use and the level the child sees, and the fast start ends', () => {
  fresh();
  Q.quizSetLevel('math', 40);
  assert.deepEqual(lv().math, { use: 40, best: 40, fast: false, right: 0, wrong: 0 });
  assert.equal(Q.quizFirstAnswer('math', true), 41);
  Q.quizSetLevel('math', 12);
  assert.deepEqual([lv().math.use, lv().math.best], [12, 12], 'the parent could not set a lower level');
  Q.quizSetLevel('words', 250); assert.equal(lv().words.use, 100);
  Q.quizSetLevel('words', -4); assert.equal(lv().words.use, 1);
  Q.quizSetBand(4); Q.quizSetLevel('words', 5);
  assert.deepEqual([lv().words.use, lv().words.best], [61, 61], 'a level outside the band was accepted');
});

test('"Start levels again" sets both subjects to the first level of the band, or 1 on Auto, with the fast start on again', () => {
  fresh();
  Q.quizSetLevel('math', 55); Q.quizSetLevel('words', 30);
  Q.quizLevelsRestart();
  assert.deepEqual(lv(), JSON.parse(JSON.stringify(Q.quizLevelsBlank())));
  Q.quizSetBand(5); Q.quizSetLevel('math', 99);
  Q.quizLevelsRestart();
  assert.deepEqual(lv(), { band: 5, math: { use: 81, best: 81, fast: true, right: 0, wrong: 0 }, words: { use: 81, best: 81, fast: true, right: 0, wrong: 0 } });
  assert.equal(Q.quizFirstAnswer('math', true), 86);
});

test('the levels read from a saved game keep only whole numbers inside the band; an old save starts at level 1', () => {
  const clean = v => JSON.parse(JSON.stringify(Q.quizLevelsFrom(v)));
  const blank = JSON.parse(JSON.stringify(Q.quizLevelsBlank()));
  for (const bad of [undefined, null, 'x', 7, [], {}]) assert.deepEqual(clean(bad), blank);
  assert.deepEqual(clean({ band: 2, math: { use: 33, best: 38, fast: false, right: 4, wrong: 1, age: 8 }, words: { use: 900, best: '<b>', fast: 'x', right: -2, wrong: 1.5 }, name: 'x' }),
    { band: 2, math: { use: 33, best: 38, fast: false, right: 4, wrong: 1 }, words: { use: 40, best: 40, fast: true, right: 0, wrong: 0 } });
  assert.deepEqual(clean({ band: 9, math: { use: 50, best: 20 } }).math, { use: 50, best: 50, fast: true, right: 0, wrong: 0 });
  assert.deepEqual(Object.keys(blank).sort(), ['band', 'math', 'words']);
  assert.deepEqual(Object.keys(blank.math).sort(), ['best', 'fast', 'right', 'use', 'wrong'], 'the levels hold more than the spec lists');
});

test('the game never asks for an age, a birthday or a school year: ages appear only as labels in the parent area', () => {
  // (the word list itself is left out: "birthday" is a word to spell)
  const noWords = c => c.slice(0, c.indexOf('const QUIZ_WORD_ROWS = [')) + c.slice(c.indexOf('// Every word as [word'));
  const code = noWords(game.slice(game.indexOf('<script type="module">')));
  const hits = [...code.matchAll(/[^\n]*\b(?:ages? \d|years? old|birthday|date of birth|school year|grade \d|how old)[^\n]*/gi)].map(m => m[0]);
  assert.ok(hits.length >= 1, 'the age hints for the parent are missing');
  for (const line of hits) assert.ok(/LEARN_BANDS|The game never asks an age|never asks an age/.test(line), 'an age is mentioned outside the parent area labels: ' + line.trim().slice(0, 120));
  assert.ok(!/\bages?\b|year/i.test(noWords(questionCode).replace(/\/\/.*$/gm, '')), 'the question code mentions an age');
});

test('the levels are kept in the saved game only: changing a level stores nothing else and sends nothing', () => {
  const code = questionCode.slice(questionCode.indexOf('// ---- Learning level'), questionCode.indexOf('// ---- Quiz report'));
  for (const word of ['localStorage', 'fetch(', 'sb.', 'logEvent', 'XMLHttpRequest', 'sendBeacon', 'playerName', 'worldId']) assert.ok(!code.includes(word), 'the level code uses ' + word);
  assert.match(game, /quiz: quizStats, levels: quizLevels,/);
  assert.match(game, /quizLevels = quizLevelsFrom\(saved\.levels\);/);
  // no new database table or access rule: the game names the same tables as before
  assert.deepEqual([...new Set([...game.matchAll(/sb\.from\('(\w+)'\)/g)].map(m => m[1]))].sort(), ['cloud_saves', 'debug_log', 'game_errors', 'game_events']);
});

// ---- Maths by level (0.6.72, SPEC-004) ----
// Works out the answer again from the text of the question, separately from the game's own sum
function workOut(q) {
  const nums = (q.show[0] && q.show[0].text ? q.show[0].text : q.text).match(/\d+/g).map(Number), t = q.text, k = q.kind;
  if (k === 'add' || (k === 'round' && t.includes('+'))) return nums[0] + nums[1];
  if (k === 'take' || k === 'round') return nums[0] - nums[1];
  if (k === 'skip' || k === 'sequence') { const d = nums[1] - nums[0]; assert.ok(nums.every((n, i) => i === 0 || n - nums[i - 1] === d), 'not a fixed step: ' + nums); return nums[3] + d; }
  if (k === 'doubling') { const r = nums[1] / nums[0]; assert.ok(r === 2 || r === 0.5, 'does not double or halve: ' + nums); assert.ok(nums.every((n, i) => i === 0 || n / nums[i - 1] === r)); return nums[3] * r; }
  if (k === 'missing') return nums[1] - nums[0];
  if (k === 'double') return nums[0] * 2;
  if (k === 'half') return nums[0] / 2;
  if (k === 'times' || k === 'longTimes') return nums[0] * nums[1];
  if (k === 'divide') return nums[0] / nums[1];
  if (k === 'missingTimes') return nums[1] / nums[0];
  if (k === 'fraction') return nums[0] / { half: 2, 'a third': 3, 'a quarter': 4, 'a fifth': 5, 'a tenth': 10 }[t.match(/is (.+) of/)[1]];
  if (k === 'twoStep') return t.includes('+') ? nums[0] * nums[1] + nums[2] : nums[0] * nums[1] - nums[2];
  if (k === 'brackets') {
    if (/^What is \(\d+ \+ \d+\) × \d+\?$/.test(t)) return (nums[0] + nums[1]) * nums[2];
    if (/^What is \(\d+ − \d+\) × \d+\?$/.test(t)) return (nums[0] - nums[1]) * nums[2];
    assert.match(t, /^What is \d+ × \(\d+ \+ \d+\)\?$/); return nums[0] * (nums[1] + nums[2]);
  }
  throw new Error('unknown kind ' + k);
}

test('each ten levels have their own kinds of maths question, as the spec lists them', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(Q.QUIZ_MATH_ROWS)), [
    ['count', 'add', 'take', 'more', 'next'], ['add', 'take', 'skip'], ['add', 'take', 'bigger', 'missing'], ['add', 'take', 'double', 'half', 'times'], ['times'],
    ['divide', 'missingTimes'], ['times', 'divide', 'sequence'], ['fraction', 'round'], ['twoStep', 'longTimes'], ['brackets', 'fraction', 'doubling']]);
  assert.deepEqual([1, 10, 11, 20, 21, 50, 51, 91, 100].map(Q.quizRowOf), [0, 0, 1, 1, 2, 4, 5, 9, 9]);
});

test('at every level from 11 to 100 every maths question has different answers, exactly one is right, and it is the right sum', () => {
  const rnd = stream(2718);
  for (let level = 11; level <= 100; level++) for (const kind of Q.QUIZ_MATH_ROWS[Q.quizRowOf(level)]) for (let i = 0; i < 250; i++) {
    const q = Q.makeQuestion(kind, rnd, level), at = kind + ' at level ' + level + ': ' + q.text + ' ' + (q.show[0] ? q.show[0].text : '');
    assert.equal(q.kind, kind);
    assert.ok(q.key.startsWith(kind + ':'), at);
    const labels = q.answers.map(a => a.label);
    assert.equal(q.answers.length, kind === 'bigger' ? 2 : 3, at);
    assert.equal(new Set(labels).size, labels.length, 'answers are not all different, ' + at);
    for (const l of labels) assert.match(l, /^\d+$/, 'an answer is not a whole number, ' + at + ' ' + labels);
    const want = kind === 'bigger' ? Math.max(...labels.map(Number)) : workOut(q);
    assert.ok(Number.isInteger(want) && want >= 0, 'the answer is not a whole number, ' + at);
    assert.equal(Number(labels[q.right]), want, 'the marked answer is not the right one, ' + at);
    assert.ok(q.hint && q.hint.drop === true, 'no hint, ' + at);
    const words = q.text.split(/\s+/).filter(w => /[A-Za-z]/.test(w));
    assert.ok(words.length >= 2 && words.length <= 8, 'too many words: ' + q.text);
  }
});

test('the numbers stay inside the range of the level and grow with it', () => {
  const rnd = stream(31337);
  const most = (kind, level, pick = q => Math.max(...(q.text + ' ' + (q.show[0] ? q.show[0].text : '')).match(/\d+/g).map(Number), Number(q.answers[q.right].label))) => {
    let m = 0; for (let i = 0; i < 600; i++) m = Math.max(m, pick(Q.makeQuestion(kind, rnd, level))); return m; };
  for (const kind of ['add', 'take']) {
    assert.ok(most(kind, 11) <= 12 && most(kind, 20) <= 20 && most(kind, 20) > 15, kind + ' within 20');
    assert.ok(most(kind, 21) <= 25 && most(kind, 30) <= 50 && most(kind, 30) > 40, kind + ' within 50');
    assert.ok(most(kind, 31) <= 55 && most(kind, 40) <= 100 && most(kind, 40) > 85, kind + ' within 100');
  }
  assert.ok(most('missing', 30) <= 20, 'the missing number in a sum within 20');
  assert.ok(most('double', 40) <= 100 && most('half', 40) <= 50, 'double and half of numbers to 50');
  for (let i = 0; i < 300; i++) assert.match(Q.makeQuestion('skip', rnd, 20).show[0].text, /^(\d+, )+\d+,$/);
  for (let i = 0; i < 300; i++) { const [x] = Q.makeQuestion('times', rnd, 35).text.match(/\d+/g).map(Number); assert.ok([2, 5, 10].includes(x), 'levels 31 to 40 are times 2, 5 and 10'); }
  assert.ok(most('times', 50) === 100 && most('times', 41) <= 50, 'times tables to 10 x 10');
  for (let i = 0; i < 300; i++) { const [, d] = Q.makeQuestion('divide', rnd, 60).text.match(/\d+/g).map(Number); assert.ok(d >= 2 && d <= 10, 'dividing by 2 to 10'); }
  assert.ok(most('round', 80) <= 1000 && most('round', 80) > 700 && most('round', 71) <= 500, 'round numbers within 1,000');
  for (let i = 0; i < 300; i++) for (const n of Q.makeQuestion('round', rnd, 75 + (i % 6)).text.match(/\d+/g)) assert.equal(n % 10, 0, 'not a round number: ' + n);
  for (let i = 0; i < 300; i++) { const [x, y] = Q.makeQuestion('longTimes', rnd, 81 + (i % 10)).text.match(/\d+/g).map(Number); assert.ok(x >= 11 && x <= 99 && y >= 2 && y <= 9, 'not a two-digit number times a one-digit number'); }
  for (let i = 0; i < 300; i++) assert.match(Q.makeQuestion('fraction', rnd, 75).text, /half|a third|a quarter/);
  for (let i = 0; i < 300; i++) assert.match(Q.makeQuestion('fraction', rnd, 95).text, /a fifth|a tenth/);
  for (let i = 0; i < 300; i++) assert.match(Q.makeQuestion('brackets', rnd, 95).text, /\(/);
});

test('questions follow the level in use: levels 81 to 100 give two-step sums and words of 7 or 8 letters; levels 1 to 20 give no word longer than 4 letters', () => {
  const rnd = stream(8128);
  const run = n => { const out = []; Q.quizRecent.length = 0; for (let i = 0; i < n; i++) out.push(Q.nextQuestion(rnd)); return out; };
  fresh(); Q.quizSetBand(5);
  let qs = run(600);
  assert.ok(qs.some(q => q.kind === 'twoStep'), 'no two-step sum');
  for (const q of qs) if (q.kind === 'word') assert.ok(q.word.length >= 7, 'a short word in levels 81 to 100: ' + q.word);
  const words = qs.filter(q => q.kind === 'word').length;
  assert.ok(words > 240 && words < 360, 'not half maths and half words: ' + words);
  fresh(); Q.quizSetBand(1); Q.quizSetLevel('words', 20); Q.quizSetLevel('math', 20);
  qs = run(600);
  for (const q of qs) { if (q.kind === 'word') assert.ok(q.word.length <= 4, 'a long word in levels 1 to 20: ' + q.word); else assert.ok(['add', 'take', 'skip'].includes(q.kind), q.kind); }
  for (let i = 10; i < qs.length; i++) assert.ok(!qs.slice(i - 10, i).some(p => p.key === qs[i].key), 'a question repeats within 10');
  fresh();
});

// ---- Hint and Another question (0.6.75, SPEC-016 part D) ----
test('SPEC-016 D: the limits for hints and swaps, the lower reward after a hint, and nothing sent when one is used', () => {
  assert.match(game, /const QUIZ_SWAPS = 2;/, 'at most 2 swaps for one visit of a friend');
  assert.match(game, /const QUIZ_MATH_HINTS = 2;/, 'at most 2 hints for a maths question');
  assert.match(game, /Math\.max\(1, Math\.floor\(q\.letters\.length \/ 2\)\)/, 'a word: at most half of the letters, rounded down, and at least one');
  assert.match(game, /q\.hint\.drop \|\| q\.answers\.length < 3 \? 1 : QUIZ_MATH_HINTS/, 'a hint never leaves only the right answer');
  assert.match(game, /const gems = f\.wrong \|\| f\.hints \? QUIZ_GEMS_LATER : QUIZ_GEMS_FIRST;/, 'a right answer after a hint gives the smaller reward');
  assert.match(game, /up = f\.wrong \|\| f\.hints \? 0 : quizFirstAnswer\(sub, true\)/, 'after a hint the level does not go up');
  const body = name => { const i = game.indexOf('function ' + name + '('); return game.slice(i, game.indexOf('\n}\n', i)); };
  for (const name of ['quizHint', 'quizSwap']) {
    const code = body(name);
    assert.ok(code.length > 100, name + ' was not found');
    assert.ok(!/logEvent|supabase|fetch\(|sb\.|cloud/i.test(code), name + ' sends or logs something');
    assert.ok(!/quizFirstAnswer/.test(code), name + ' must not move the level');
  }
  assert.match(body('quizSwap'), /quizCount\(sub, 'swaps'\)/);
  assert.match(body('quizHint'), /quizCount\(quizSubject\(f\.q\.kind\), 'hints'\)/);
  // the three small buttons, and the privacy page names the two new counts
  assert.match(game, /class="qhintb">Hint<\/button><button class="qswap">Another question<\/button><button class="qnot"[^>]*>Not now<\/button>/);
  assert.match(game, /#quizPanel \.qrow button\{[^}]*min-height:48px/, 'every button is at least 48 px tall');
  const privacy = fs.readFileSync(path.join(root, 'www', 'privacy.html'), 'utf8');
  assert.match(privacy, /how many times the Hint button was used and how many questions were swapped/);
});
