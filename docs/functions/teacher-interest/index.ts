// Supabase Edge Function "teacher-interest" (SPEC-032). Source kept here so every change has a commit; deploy it with
// verify_jwt off (the page calls it with the public site key, and the unsubscribe link is opened from an email).
// Secrets, set only in Supabase (never in this repository): GMAIL_USER (yammay@gmail.com for now), GMAIL_APP_PASSWORD
// (a Gmail app password), IP_SALT (any long random text). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are given by Supabase.
// Mail goes through Gmail's own server on port 465 (Supabase blocks outgoing ports 25 and 587).
//
// POST {action:'request', name, school, country, email, consent_text}  sends a 6-digit code; keeps nothing on the list
// POST {action:'confirm', email, code}                                  a right code puts the person on the list
// POST {action:'test_news'} with the owner's sign-in                     one test news email to the owner's own address
// GET  ?unsubscribe=<token>                                             deletes the row at once
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import nodemailer from 'npm:nodemailer@6.9.16';

const OWNER = 'yammay@gmail.com';
const SITE = 'https://free-game-vitale.vercel.app';
const FN_URL = Deno.env.get('SUPABASE_URL') + '/functions/v1/teacher-interest';
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const CORS = { 'access-control-allow-origin': SITE, 'access-control-allow-headers': 'content-type, apikey, authorization', 'access-control-allow-methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
const fail = (error: string, status = 400) => json({ ok: false, error }, status);

async function sha256(text: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const sixDigits = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
const clean = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max + 1);
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 200;

let mailer: ReturnType<typeof nodemailer.createTransport> | null = null;
function mail(to: string, subject: string, text: string, headers: Record<string, string> = {}) {
  mailer ??= nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: Deno.env.get('GMAIL_USER'), pass: Deno.env.get('GMAIL_APP_PASSWORD') } });
  return mailer.sendMail({ from: { name: 'Adventurers of Drenerics', address: Deno.env.get('GMAIL_USER') || OWNER }, to, subject, text, headers });
}

async function request(body: Record<string, unknown>, ip: string) {
  const name = clean(body.name, 80), school = clean(body.school, 80), email = clean(body.email, 200).toLowerCase();
  const country = String(body.country), consent = clean(body.consent_text, 400);
  if (!name || name.length > 80 || !school || school.length > 80 || !['CA', 'US'].includes(country) || !validEmail(email) || !consent) return fail('invalid');
  const hour = new Date(Date.now() - 3600e3).toISOString(), ipHash = await sha256((Deno.env.get('IP_SALT') || '') + ip);
  const [byEmail, byIp] = await Promise.all([
    db.from('teacher_code_sends').select('id', { count: 'exact', head: true }).eq('email', email).gte('sent_at', hour),
    db.from('teacher_code_sends').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('sent_at', hour),
  ]);
  if ((byEmail.count ?? 0) >= 3 || (byIp.count ?? 0) >= 10) return fail('rate_limited', 429);
  const code = sixDigits();
  const { error } = await db.from('teacher_interest_requests').upsert({ email, name, school, country, consent_text: consent,
    code_hash: await sha256(email + ':' + code), tries: 0, code_at: new Date().toISOString() });
  if (error) return fail('server', 500);
  await db.from('teacher_code_sends').insert({ email, ip_hash: ipHash });
  await mail(email, 'Your Drenerics code', `${code}\n\nIt works for 15 minutes. If you did not ask for this, you can ignore this email.\n`);
  return json({ ok: true });
}

async function confirm(body: Record<string, unknown>) {
  const email = clean(body.email, 200).toLowerCase(), code = String(body.code ?? '');
  const { data: r } = await db.from('teacher_interest_requests').select('*').eq('email', email).maybeSingle();
  if (!r) return fail('expired');
  if (r.tries >= 5) return fail('too_many_tries');
  if (Date.now() - Date.parse(r.code_at) > 15 * 60e3) return fail('expired');
  if (!/^\d{6}$/.test(code) || await sha256(email + ':' + code) !== r.code_hash) {
    await db.from('teacher_interest_requests').update({ tries: r.tries + 1 }).eq('email', email);
    return fail(r.tries + 1 >= 5 ? 'too_many_tries' : 'bad_code');
  }
  // Already on the list: the same thank-you, and the page never says so
  const { data: had } = await db.from('teacher_interest').select('id').eq('email', email).maybeSingle();
  if (!had) {
    const { error } = await db.from('teacher_interest').insert({ name: r.name, school: r.school, country: r.country, email,
      consent_text: r.consent_text, consent_at: r.created_at });
    if (error) return fail('server', 500);
  }
  await db.from('teacher_interest_requests').delete().eq('email', email);
  return json({ ok: true });
}

// Every news email: sender named, a true subject, the mailing address, the Contact page and a one-click unsubscribe
async function newsEmail(to: string, token: string, subject: string, text: string) {
  const { data } = await db.from('owner_text_settings').select('value').eq('key', 'mail_address').maybeSingle();
  const address = (data?.value || '').trim();
  if (!address) throw new Error('no mailing address');
  const unsub = FN_URL + '?unsubscribe=' + token;
  return mail(to, subject, `${text}\n\n--\nAdventurers of Drenerics\n${address}\nContact: ${SITE}/contact.html\nUnsubscribe: ${unsub}\n`,
    { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });
}

async function testNews(req: Request) {
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
  const { data } = await db.auth.getUser(jwt);
  if (data?.user?.email !== OWNER) return fail('owner_only', 403);
  const { data: row } = await db.from('teacher_interest').select('unsub_token').eq('email', OWNER).maybeSingle();
  try {
    await newsEmail(OWNER, row?.unsub_token || 'test', 'Test: news for teachers from Adventurers of Drenerics',
      'This is a test of the news email for teachers. The teacher area is not open yet.');
  } catch (e) { return fail(String((e as Error).message) === 'no mailing address' ? 'no_mailing_address' : 'mail_failed', 500); }
  return json({ ok: true });
}

async function unsubscribe(token: string) {
  if (/^[0-9a-f]{48}$/.test(token)) await db.from('teacher_interest').delete().eq('unsub_token', token);
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title>' +
    '<p style="font:18px system-ui;max-width:40em;margin:40px auto;padding:0 16px">You are unsubscribed. Your details have been deleted from the list. ' +
    `<a href="${SITE}/">Adventurers of Drenerics</a></p>`, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  await db.rpc('teacher_interest_cleanup');
  const url = new URL(req.url);
  const token = url.searchParams.get('unsubscribe');
  if (token !== null) return unsubscribe(token);   // GET from the email link, or POST from the one-click header
  if (req.method !== 'POST') return fail('method', 405);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return fail('invalid'); }
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  try {
    if (body.action === 'request') return await request(body, ip);
    if (body.action === 'confirm') return await confirm(body);
    if (body.action === 'test_news') return await testNews(req);
  } catch (_e) { return fail('server', 500); }
  return fail('invalid');
});
