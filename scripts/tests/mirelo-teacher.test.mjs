// Teacher Mirelo, built-in talks (0.6.103; the first part of SPEC-027): the lessons and the rules in the code.
// The talk itself is checked in the browser tests. Run:  node --test scripts/tests/mirelo-teacher.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const game = fs.readFileSync(path.join(root, 'build', 'prototype-3d-v7.html'), 'utf8');
const code = game.slice(game.indexOf('// ---- Teacher Mirelo: talks from lessons built into the game (0.6.103'), game.indexOf('// ---- Quiz questions (0.6.63'));
const plain = code.replace(/^\s*\/\/.*$/gm, '');
const pick = name => { const a = code.indexOf('const ' + name + ' = '), b = code.indexOf('\n};\n', a); return new Function('return ' + code.slice(a + ('const ' + name + ' = ').length, b + 2))(); };
const LESSONS = pick('MIRELO_LESSONS');
const WHY = JSON.parse(code.slice(code.indexOf('const MIRELO_WHY = ') + 19, code.indexOf('};', code.indexOf('const MIRELO_WHY = ')) + 1));
const LINES = pick('TEACH_LINES');
const ROWS = new Function('const QUIZ_MATH_KINDS = ' + /const QUIZ_MATH_KINDS = (\[[^\]]+\])/.exec(game)[1] + '; return ' + game.slice(game.indexOf('const QUIZ_MATH_ROWS = [') + 23, game.indexOf('];', game.indexOf('const QUIZ_MATH_ROWS = [')) + 1))();
const words = s => s.trim().split(/\s+/).length;
const every = [...Object.values(LESSONS.math).flat().flat(), ...LESSONS.words.flat().flat(), ...Object.values(WHY), ...Object.values(LINES).flat()];

test('100 lessons: two for every kind of maths question at every ten levels, four for words at every ten levels', () => {
  const maths = Object.values(LESSONS.math).reduce((n, l) => n + l.length, 0), wordsN = LESSONS.words.reduce((n, l) => n + l.length, 0);
  assert.equal(maths, 60); assert.equal(wordsN, 40); assert.equal(maths + wordsN, 100);
  ROWS.forEach((kinds, row) => { for (const kind of kinds) { const l = LESSONS.math[row + ':' + kind]; assert.ok(l && l.length === 2, 'lessons for ' + kind + ' at row ' + row); assert.ok(WHY[kind], 'a why for ' + kind); } });
  assert.equal(Object.keys(LESSONS.math).length, ROWS.reduce((n, k) => n + k.length, 0), 'no lesson for a kind the game does not ask');
  assert.equal(LESSONS.words.length, 10); for (const r of LESSONS.words) assert.equal(r.length, 4);
  assert.ok(WHY.word);
  const all = [...Object.values(LESSONS.math).flat(), ...LESSONS.words.flat()];
  for (const l of all) assert.equal(l.length, 2, 'what he says, and what he shows');
  assert.equal(new Set(all.map(l => l[0])).size, 100, 'no lesson twice');
});

test('everything he says is short, kind, about the lesson only, and never about buying or about the child', () => {
  for (const s of every) {
    assert.ok(words(s) <= 40, 'over 40 words: ' + s);
    assert.doesNotMatch(s, /\b(pass|buy|bought|price|pay|paid|money|purchase|upgrade|parent area|subscribe|unlock)\b/i, 'sales talk: ' + s);
    assert.doesNotMatch(s, /your name|how old|where do you live|your school|your family|your (mum|mom|dad)|your address|phone/i, 'something personal: ' + s);
    assert.doesNotMatch(s, /\b(stupid|slow|wrong again|bad|silly|dumb|kill|blood|scary)\b/i, 'not kind: ' + s);
    assert.doesNotMatch(s, /https?:|www\.|@/, s);
  }
  assert.match(LINES.greet, /I am a magic helper made by a computer program, called an AI\./, 'he says what he is, in the fixed words of the spec');
  assert.doesNotMatch(Object.values(LINES).flat().join(' '), /\bI am a (person|human|man)\b/i);
});

test('no typing, no listening, nothing sent, no gems; the right answer is the game\'s own; 12 replies at most', () => {
  assert.doesNotMatch(plain, /<input|<textarea|contenteditable|getUserMedia|SpeechRecognition|webkitSpeech/i, 'no text box and no microphone');
  assert.doesNotMatch(plain, /fetch\(|sb\.|sendSync|channel\.|XMLHttpRequest|functions\.invoke/, 'a built-in talk sends nothing');
  assert.doesNotMatch(plain, /addItem|inv\.gem|inv\[/, 'talks give no gems');
  assert.match(plain, /makeQuestion\(t\.lesson\.kind, Math\.random, t\.level\)/, 'maths questions are made by the game');
  assert.match(plain, /if \(r\.a === t\.q\.right\)/, 'the game decides whether an answer is right');
  assert.match(plain, /QUIZ_WORD_ROWS\[quizRowOf\(level\)\]/, 'words come from the game\'s own list');
  assert.match(plain, /TEACH_MAX_REPLIES = 12/);
  assert.match(plain, /quizFirstAnswer\(t\.subject, true\)/); assert.match(plain, /quizFirstAnswer\(t\.subject, false\)/);
  assert.doesNotMatch(plain, /quizBadge|quizStats|quizCount\(/, 'his own badges, not the quiz badges or the quiz report');
  assert.match(plain, /paused = true;/, 'the game stands still: no monster comes closer');
  assert.match(plain, /speechSynthesis/); assert.match(plain, /!mireloVoice \|\| !vol\.sfx/, 'silent when his voice or the sounds are off');
  assert.match(plain, /aiFlagHtml\('lesson-' \+ teach\.lesson\.id\)/, 'every turn of a talk has the flag');
});

test('only the test switch shows him: no pass exists yet, and nothing a child can see mentions one', () => {
  assert.match(plain, /let teachOn = \/\[\?&\]teacher=1\\b\/\.test\(location\.search\);/);
  assert.match(game, /if \(teachOn && !mireloNeedsLesson\(\)\) \{ openTeach\(\); return; \}/);
  assert.match(game, /\(teachOn \? `<div[^`]*Mirelo's voice/, 'the voice switch shows only with him');
  for (const f of ['www/how-to-play.html', 'www/index.html']) assert.doesNotMatch(fs.readFileSync(path.join(root, f), 'utf8'), /Teacher Mirelo|Teacher Pass/, f + ' must not show a feature that is not in the game');
});

test('the lessons running out is recorded, and so is each talk', () => {
  assert.match(plain, /logOnce\('teacher_lessons_cap', subject \+ ' row' \+ quizRowOf\(level\), 600000\)/);
  assert.match(plain, /logEvent\('teacher_talk', subject \+ ' start built-in'\)/);
  assert.match(plain, /logEvent\('teacher_talk', t\.subject \+ ' end right' \+ t\.right \+ ' replies' \+ t\.replies\)/);
  const ev = fs.readFileSync(path.join(root, 'docs', 'EVENTS.md'), 'utf8');
  assert.match(ev, /`teacher_talk`/); assert.match(ev, /`teacher_lessons_cap`/);
});
