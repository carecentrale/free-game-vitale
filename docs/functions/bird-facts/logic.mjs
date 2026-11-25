// Bird facts (SPEC-037): the rules of the backend function "bird-facts", kept apart from the server parts so the tests
// can run them. A fact is one true, simple thing about a kind of bird, written in five reading versions (one for each
// Words-level band). It is written by one AI request and checked by a second, separate AI request; only a fact that
// passes every check, and whose five versions are within their word limits when counted here in code, is approved.
// Nothing about any child or player is ever part of a request: only the bird kind, the place, the rules and pool facts.
export const KINDS = {
  songbird: { name: 'songbird', places: ['grassland', 'forest', 'savanna', 'taiga'] },
  parrot: { name: 'parrot', places: ['rainforest'] },
  owl: { name: 'owl', places: ['forest', 'taiga'] },
  duck: { name: 'duck', places: ['lake', 'river'] },
  penguin: { name: 'penguin', places: ['snow near the sea'] },
  gull: { name: 'gull', places: ['sea', 'beach'] },
  geese: { name: 'goose', places: ['sky over grassland, forest or taiga'] },
  hawk: { name: 'hawk', places: ['grassland', 'savanna', 'desert'] },
};
export const WORD_LIMITS = [10, 12, 15, 18, 20];   // band 1 (Words levels 1 to 20) to band 5 (81 to 100)
export const MIN_PER_KIND = 15, MAX_PER_KIND = 200, DAILY_START = 50;
export const CHECKS = ['true', 'safe', 'simple', 'limits', 'new', 'same'];
export const RULES = [
  'Each fact is true and widely accepted.',
  'Each version is one sentence within its word limit.',
  'Use words a child at that reading level can read.',
  'Kind and calm: nothing about animals being hurt, killed or eaten, no blood, no fear.',
  'No people, brands, films, games, politics or religion.',
  'About the real bird, not a story.',
  'Not a repeat of a fact already in the pool.',
];
export const wordCount = s => String(s).trim().split(/\s+/).filter(Boolean).length;
export const withinLimits = v => Array.isArray(v) && v.length === 5 && v.every((s, i) => typeof s === 'string' && s.trim().length > 0 && s.length <= 200 && wordCount(s) <= WORD_LIMITS[i] && !/[<>{}\\]/.test(s));

// The request that asks for new facts. pool: facts already there for this kind (their middle version), to avoid repeats.
export function writerRequest(kind, place, pool, n, model) {
  const K = KINDS[kind];
  return {
    model, max_tokens: 2000,
    system: 'You write short, true facts about real birds for children aged 6 to 12 in a family game. Answer with JSON only.',
    messages: [{ role: 'user', content:
      `Write ${n} new fun facts about the ${K.name}` + (place ? ` (it lives here in the game: ${place}; a fact may be about that place)` : '') + '.\n' +
      'Write every fact in five versions that say the same fact, for five reading levels:\n' +
      WORD_LIMITS.map((w, i) => `version ${i + 1}: at most ${w} words` + (i === 0 ? ', very short common words, one idea, about age 6' : i === 4 ? ', may use one richer word that the sentence explains, about age 11 to 12' : '')).join('\n') + '\n' +
      'Rules:\n' + RULES.map(r => '- ' + r).join('\n') + '\n' +
      'Facts already in the pool (do not repeat them):\n' + (pool.length ? pool.map(p => '- ' + p).join('\n') : '- (none yet)') + '\n' +
      'Answer with a JSON array only, like [{"v":["...","...","...","...","..."]}].' }],
  };
}
// The separate request that checks one fact. It answers yes or no to each question.
export function checkerRequest(kind, v, pool, model) {
  return {
    model, max_tokens: 300,
    system: 'You check facts about real birds before children aged 6 to 12 see them in a family game. Be strict. Answer with JSON only.',
    messages: [{ role: 'user', content:
      `Bird: ${KINDS[kind].name}.\nThe fact, in five versions for five reading levels (word limits ${WORD_LIMITS.join(', ')}):\n` + v.map((s, i) => `${i + 1}. ${s}`).join('\n') + '\n' +
      'Facts already in the pool:\n' + (pool.length ? pool.map(p => '- ' + p).join('\n') : '- (none yet)') + '\n' +
      'Answer these with true or false:\n- "true": is the fact true and widely accepted?\n- "safe": is it safe and kind for a 6-year-old (nothing about animals being hurt, killed or eaten, no blood, no fear; no people, brands, films, games, politics or religion)?\n' +
      '- "simple": is each version simple enough for its reading level?\n- "limits": is each version within its word limit?\n- "new": is it NOT a repeat of a fact in the pool?\n- "same": do the five versions say the same fact?\n' +
      'Answer with JSON only: {"true":true,"safe":true,"simple":true,"limits":true,"new":true,"same":true,"reason":"a few words if any answer is false"}' }],
  };
}
const firstJson = (text, open, close) => { const a = String(text).indexOf(open), b = String(text).lastIndexOf(close); if (a < 0 || b <= a) return null; try { return JSON.parse(String(text).slice(a, b + 1)); } catch (e) { return null; } };
export function parseFacts(text) {
  const arr = firstJson(text, '[', ']');
  return Array.isArray(arr) ? arr.map(f => f && Array.isArray(f.v) ? f.v.map(s => String(s).trim()) : null).filter(Boolean) : [];
}
// Approved only with yes to every check from the second AI and the word limits counted here. Returns { ok, reason }.
export function judge(v, verdictText) {
  if (!withinLimits(v)) return { ok: false, reason: 'a version is over its word limit, or is not plain text' };
  const j = firstJson(verdictText, '{', '}');
  if (!j) return { ok: false, reason: 'the check gave no answer' };
  const no = CHECKS.filter(c => j[c] !== true);
  return no.length ? { ok: false, reason: ('failed: ' + no.join(', ') + (j.reason ? '. ' + String(j.reason).slice(0, 200) : '')) } : { ok: true, reason: '' };
}
// One run: for the kinds with the fewest approved facts first, write and check new facts until today's limit is used.
// d: { counts() -> {kind: approved}, madeToday() -> number, limit() -> number, pool(kind) -> [text], ask(request) -> text, save(row) }
export async function run(d, model, only = null) {
  let left = Math.max(0, (await d.limit()) - (await d.madeToday()));
  const counts = await d.counts(), out = { made: 0, approved: 0, rejected: 0, kinds: {} };
  const order = Object.keys(KINDS).filter(k => !only || k === only).sort((a, b) => (counts[a] || 0) - (counts[b] || 0));
  for (const kind of order) {
    if (left <= 0 || (counts[kind] || 0) >= MAX_PER_KIND) continue;
    const want = Math.min(left, 5, MAX_PER_KIND - (counts[kind] || 0)), K = KINDS[kind], place = K.places[(counts[kind] || 0) % K.places.length];
    const pool = await d.pool(kind);
    const facts = parseFacts(await d.ask(writerRequest(kind, place, pool, want, model))).slice(0, want);
    for (const v of facts) {
      const verdict = withinLimits(v) ? judge(v, await d.ask(checkerRequest(kind, v, pool, model))) : judge(v, '');
      await d.save({ kind, place, v: v.slice(0, 5).map(s => String(s).slice(0, 200)), status: verdict.ok ? 'approved' : 'rejected', reason: verdict.reason });
      out.made++; left--; out[verdict.ok ? 'approved' : 'rejected']++; out.kinds[kind] = (out.kinds[kind] || 0) + 1;
      if (verdict.ok) pool.push(v[2]);
    }
  }
  return out;
}
