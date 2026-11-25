// Supabase Edge Function "bird-facts" (SPEC-037). Source kept here so every change has a commit. Deploy with verify_jwt off.
// It writes new fun facts about the game's birds with Anthropic's API (Claude) and has each one checked by a second,
// separate request before it can reach any game. Nothing about any child or player is sent: only the bird kind, the
// place, the rules and facts already in the pool (see logic.mjs). Nothing a child does calls this function.
// Secret, set only in Supabase (never in this repository): ANTHROPIC_API_KEY (the owner's key). Optional: FACTS_MODEL (the
// Claude model to use; a small, low-cost one is enough). The weekly call (migration 0021) carries a secret that was made
// inside the database and is kept in its vault; this function asks the database whether it is the right one, and never sees it.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are given by Supabase.
//
// POST {action:'run', kind?} with the owner's sign-in, or with the weekly call's header x-cron-secret: writes and checks new
// facts, for 100 seconds at most in one call (the weekly schedule calls three times, ten minutes apart).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { run, DAILY_START, KINDS } from './logic.mjs';

const OWNER = 'yammay@gmail.com';
const SITE = 'https://free-game-vitale.vercel.app';
const MODEL = Deno.env.get('FACTS_MODEL') || 'claude-haiku-5-5';
const url = Deno.env.get('SUPABASE_URL')!;
const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const CORS = { 'access-control-allow-origin': SITE, 'access-control-allow-headers': 'content-type, apikey, authorization', 'access-control-allow-methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

async function ask(request: Record<string, unknown>): Promise<string> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(request),
  });
  if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error('ai ' + r.status + ' ' + ((/"message":\s*"([^"]{0,70})/.exec(t) || [])[1] || '')); }   // Anthropic's own short reason, for example "credit balance is too low"
  const j = await r.json();
  return (j.content || []).map((c: { text?: string }) => c.text || '').join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    // Who may call: the once-a-day call (its secret), or the owner signed in on the admin page
    const cron = req.headers.get('x-cron-secret') || '';
    let allowed = false;
    if (cron.length >= 32 && cron.length <= 128) { const { data } = await db.rpc('bird_facts_cron_ok', { p: cron }); allowed = data === true; }
    if (!allowed) {
      const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false }, global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
      const { data } = await asUser.auth.getUser();
      allowed = !!data && !!data.user && data.user.email === OWNER;
    }
    if (!allowed) return json({ ok: false, error: 'owner only' }, 403);
    if (!Deno.env.get('ANTHROPIC_API_KEY')) return json({ ok: false, error: 'no key' });
    const body = await req.json().catch(() => ({}));
    const only = typeof body.kind === 'string' && KINDS[body.kind as keyof typeof KINDS] ? body.kind : null;
    const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
    const began = Date.now();
    const out = await run({
      counts: async () => { const { data } = await db.from('bird_facts').select('kind').eq('status', 'approved'); const c: Record<string, number> = {}; for (const r of data || []) c[r.kind] = (c[r.kind] || 0) + 1; return c; },
      madeToday: async () => { const { count } = await db.from('bird_facts').select('id', { count: 'exact', head: true }).gte('created_at', dayStart.toISOString()); return count || 0; },
      limit: async () => { const { data } = await db.from('game_settings').select('value').eq('key', 'facts_per_day').maybeSingle(); return data ? data.value : DAILY_START; },
      pool: async (kind: string) => { const { data } = await db.from('bird_facts').select('v3').eq('kind', kind).in('status', ['approved', 'held']).limit(200); return (data || []).map((r: { v3: string }) => r.v3); },
      ask,
      timeUp: () => Date.now() - began > 100000,
      save: async (row: { kind: string; place: string; v: string[]; status: string; reason: string }) => { await db.from('bird_facts').insert({ kind: row.kind, place: row.place, v1: row.v[0] || '', v2: row.v[1] || '', v3: row.v[2] || '', v4: row.v[3] || '', v5: row.v[4] || '', status: row.status, reason: row.reason }); },
    }, MODEL, only);
    return json({ ok: true, ...out });
  } catch (e) {
    // what went wrong, in a few words (for example "ai 404"): never anything about a caller, a key or a request
    const why = String((e as Error)?.message || e).replace(/[^a-zA-Z0-9 _.:-]/g, '').slice(0, 90);
    console.error('bird-facts: ' + why);
    return json({ ok: false, error: 'server', why });
  }
});
