// Vital the elephant, your guide (0.6.73, SPEC-011): the rules for his tips, and the privacy rules of the feature.
// The code is read from the game file at test time. No browser needed.
// Run from the repository root:  node --test scripts/tests/vital.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const game = fs.readFileSync(path.join(root, 'build', 'prototype-3d-v7.html'), 'utf8');
const start = game.indexOf('// ---- Vital the elephant, your guide (0.6.73');
const end = game.indexOf('// ---- Quiz questions (0.6.63', start);
if (start < 0 || end < 0) throw new Error('Vital code markers not found in the game file');
const code = game.slice(start, end), plain = code.replace(/\/\/.*$/gm, '');
const friendCode = game.slice(game.indexOf('// ---- Quiz Friends: the characters'), game.indexOf('// ---- Game loop ----'));
const model = friendCode.slice(friendCode.indexOf("} else if (kind === 'vital') {"), friendCode.indexOf('// The "?" bubble over its head'));

// The tips and the reading of what the device remembers, run for real (the rest needs the game around it)
const store = {};
const ctx = vm.createContext({ Math, Number, JSON, isTouch: false, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } } });
const V = vm.runInContext(code.slice(0, code.indexOf('let vitalVisit')) + '\n;({ VITAL_TIPS, VITAL_FIRST, VITAL_GAP, VITAL_MAX, VITAL_SKIP, VITAL_FRIEND_AFTER, VITAL_KEY, vitalFrom })', ctx);

test('there are twelve tips, in the order of the spec, each in touch wording and in computer wording', () => {
  assert.equal(V.VITAL_TIPS.length, 12);
  assert.equal(V.VITAL_TIPS[0][0], 'Hi! I am Vital. I can show you how to play.');
  assert.deepEqual([...V.VITAL_TIPS[1]], ['Push the thumb stick to walk. Tap JUMP to jump.', 'Use W A S D to walk. Press Space to jump.']);
  assert.equal(V.VITAL_TIPS[11][0], 'Lost? Tap the teleport button. After a wait it takes you back to the start.');
  const about = ['Vital', 'walk', 'turn the view', 'dig', 'build', 'Gems', 'quick bar', 'Monsters', 'question', 'Drop', 'swim', 'teleport'];
  V.VITAL_TIPS.forEach((tip, i) => {
    assert.ok(tip.length === 1 || tip.length === 2, 'tip ' + (i + 1));
    for (const t of tip) {
      assert.ok(t.includes(about[i]), 'tip ' + (i + 1) + ' is not about ' + about[i] + ': ' + t);
      assert.ok(t.length <= 80 && t.split(/\s+/).length <= 16, 'tip ' + (i + 1) + ' is not short: ' + t);
      assert.ok(!/[<>&]/.test(t));
    }
    if (tip[1]) { assert.ok(!/\b(tap|finger|thumb stick)\b/i.test(tip[1]), 'computer wording speaks of touch: ' + tip[1]); assert.ok(!/\b(click|mouse|press [A-Z])\b/i.test(tip[0]), 'touch wording speaks of a mouse or keys: ' + tip[0]); }
    else assert.ok(!/\b(finger|thumb stick|click|mouse)\b/i.test(tip[0]) || i === 11, 'a tip for both devices names one device: ' + tip[0]);
  });
});

test('the numbers are as the owner agreed: 3 seconds, 2 minutes apart, at most 4 in a visit, back on the third visit, a quiz friend 20 seconds after him', () => {
  assert.deepEqual([V.VITAL_FIRST, V.VITAL_GAP, V.VITAL_MAX, V.VITAL_SKIP, V.VITAL_FRIEND_AFTER], [3, 120, 4, 2, 20]);
  // he comes back only while the child is moving, never while a panel is open, and after the start of a visit never while a monster is within 10 blocks
  assert.match(friendCode, /if \(vitalVisit\.first \|\| Math\.hypot\(vx, vz\) > 0\.1\) vitalVisit\.wait -= dt;/);
  assert.match(friendCode, /vitalVisit\.wait <= 0 && !anyPanelOpen\(\) && \(vitalVisit\.first \|\| !monsterNear\(FRIEND_MONSTER_CLEAR\)\)/);
  assert.match(game, /const anyPanelOpen = \(\) => [^;]*!!tipPanel/);
  // one character at a time: Vital and a quiz friend share the one place on screen
  assert.match(friendCode, /function spawnFriend\(forceKind\) \{\n  if \(friend\) return false;/);
  // a tip counts as seen only after OK; closing another way keeps it unseen and he waits 20 seconds more
  assert.match(plain, /function tipClose\(\) \{[^}]*closeTip\(\);\s*if \(friend && friend\.guide\) friend\.age = Math\.max\(friend\.age, FRIEND_STAY - 20\);/);
  assert.equal((plain.match(/vital\.seen = /g) || []).length, 1, 'the tips seen are changed in more than one place');
  assert.ok(plain.slice(plain.indexOf('function tipOk'), plain.indexOf('function vitalAway')).includes('vital.seen = Math.max(vital.seen, f.tip + 1)'));
});

test('what the device remembers is read safely: the switch, the tips seen, the "ask again" choice and the visits to skip, and nothing else', () => {
  const clean = v => JSON.parse(JSON.stringify(V.vitalFrom(v)));
  const blank = { on: true, seen: 0, ask: false, skip: 0 };
  for (const bad of [undefined, null, 'x', 7, []]) assert.deepEqual(clean(bad), blank);
  assert.deepEqual(clean({ on: false }), { on: false, seen: 0, ask: false, skip: 0 });
  assert.deepEqual(clean({ on: 1, seen: 99, ask: 'yes', skip: 50, name: 'x', tips: ['a'] }), { on: true, seen: 12, ask: false, skip: 2 });
  assert.deepEqual(clean({ seen: 5, ask: true, skip: 1 }), { on: true, seen: 5, ask: true, skip: 1 });
  assert.deepEqual(clean({ seen: -1, skip: 1.5 }), blank);
});

test('nothing about the tips is sent or logged: the device keeps one small note, and Vital is not sent to a shared world', () => {
  for (const word of ['logEvent', 'debugLog', 'logError', 'fetch(', 'XMLHttpRequest', 'sendBeacon', 'sb.', 'channel', 'shareBlock', 'sessionStorage', 'document.cookie', 'indexedDB', 'playerName', 'worldId', 'saveGame'])
    assert.ok(!plain.includes(word), 'the Vital code uses ' + word);
  assert.deepEqual([...plain.matchAll(/localStorage\.(\w+)\(([^)]*)\)/g)].map(m => m[1] + ' ' + m[2]), ['getItem VITAL_KEY', 'setItem VITAL_KEY, JSON.stringify(vital']);
  assert.equal(V.VITAL_KEY, 'kidsgame.vital');
  const save = game.slice(game.indexOf('function saveGame()'), game.indexOf('let worldLoaded'));
  assert.ok(!/vital/i.test(save), 'the saved game (and so the cloud save) holds something about Vital');
  const meta = game.slice(game.indexOf('function myMeta()'), game.indexOf('function onPresence()'));
  // 0.6.81 (SPEC-024, owner's rule of 22 Nov 2026): the friend (or Vital) is seen by everyone as a character, so its
  // kind, place and turn are sent; never its question, answer, hints, tips, the child's level or anything the child typed
  assert.ok(!/friend\.q\b|quiz(Levels|Stats|On)|question|answer|hint|tip|level/i.test(meta), 'only the character is sent to the shared world, never its questions or tips');
  assert.ok(/friend\.kind, Math\.round\(friend\.x/.test(meta), 'the friend is sent as a character: kind and place');
});

test('tap only: the tip panel has no place to type, no timer and no countdown, and never opens by itself', () => {
  assert.ok(!/<input|<textarea|contenteditable|keydown/i.test(code), 'the tip panel has a place to type');
  assert.ok(!/setTimeout|setInterval|countdown|seconds left|hurry|too late|missed/i.test(plain), 'the tip code runs a timer or mentions a missed chance');
  assert.ok(plain.includes('>OK</button>') && plain.includes('>No more tips</button>') && plain.includes('>Yes</button>') && plain.includes('>Not now</button>'));
  // openTip is called from a tap on Vital only (and offered to the tests)
  const calls = [...game.matchAll(/[^\n]*\bopenTip\(\)[^\n]*/g)].map(m => m[0].trim());
  assert.deepEqual(calls.filter(l => !l.startsWith('function openTip')), ['if (friend.guide) openTip(); else openQuiz();']);
  assert.ok(plain.includes("'OK! I will say hello another day.'") && plain.includes("'Hi again! Do you want tips?'"));
  assert.ok(friendCode.includes("'Vital is here! Tap him to say hello.'"));
});

test('Vital is made in code from simple shapes: grey, two large ears that are white inside, a trunk with a paler tip, black eyes, a pink mouth and four legs; no model, picture or photo file', () => {
  assert.ok(model.length > 400, 'the elephant model was not found');
  assert.ok(!/loadModel|\.glb|\.png|\.jpe?g|\.svg|https?:|<img/i.test(model + code), 'Vital uses an outside file');
  assert.match(model, /const grey = 0xb4bac4, pale = 0xdfe3ea;/);
  assert.match(model, /for \(const s of \[-1, 1\]\) \{[\s\S]*0xffffff[\s\S]*0x151515[\s\S]*for \(const z of \[0\.2, -0\.3\]\)/, 'two ears with white inside, two eyes and four legs');
  assert.match(model, /0xf28aa5/);
  assert.match(model, /wave = pivot\(0, 0\.97, 0\.38\);/);
  assert.match(friendCode, /if \(u\.trunk\) u\.wave\.rotation\.x = away \? 0 : -0\.85 \+ w \* 0\.4;/);
  // his name is fixed: drawn in code, the same word everywhere, and nothing lets a child change it
  assert.match(friendCode, /nx\.fillText\('Vital', 128, 52\);/);
  assert.match(friendCode, /cx\.fillText\(kind === 'vital' \? '!' : '\?', 64, 60\);/);
  assert.ok(!/Vitale|vital\.name|rename/i.test(game.slice(game.indexOf('<script type="module">'))), 'the name can be changed or is spelled another way');
  // no photo of the toy, and no maker's name, anywhere in the repository's game or website folders
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  for (const f of [...walk(path.join(root, 'www')), ...walk(path.join(root, 'build'))]) assert.ok(!/vital|elephant|toy/i.test(path.basename(f)) || /\.html$/.test(f), 'a file for Vital was added: ' + f);
});

test('he gives tips only: no questions and no gems; the quiz friends keep the questions', () => {
  assert.ok(!/addItem|gem|makeQuestion|nextQuestion|quizCount|quizFirstAnswer/.test(plain.replace(/Gems sparkle[^']*'|gives you gems\.'/g, '')), 'the Vital code gives gems or asks a question');
  assert.match(friendCode, /const FRIEND_KINDS = \['owl', 'turtle', 'robot'\];/);
  assert.match(friendCode, /function openQuiz\(\) \{\n  if \(!friend \|\| friend\.guide \|\| quizPanel\) return;/);
  // switching quiz friends off does not send Vital away, and the other way round
  assert.match(friendCode, /if \(!quizOn && friend && !friend\.guide\) \{ closeQuiz\(\); removeFriend\(\); \}/);
  assert.match(plain, /if \(!vital\.on && friend && friend\.guide\) \{ closeTip\(\); removeFriend\(\); \}/);
});
