// Delete my data (SPEC-010). Called by the game and by /delete-my-data.html for a signed-in parent.
//   { action: 'request' }            emails a 6-digit code to the address the parent signed in with
//   { action: 'confirm', code }      with the right code: deletes the cloud save and the parent account
// The email is sent by the sign-in service the game already uses (no new service). The rules are in logic.mjs.
// Always answers 200 with { ok } or { error }, so the game can show a plain message.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle } from './logic.mjs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
    const asUser = createClient(url, anonKey, { ...noSession, global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: who } = await asUser.auth.getUser();
    const user = who && who.user ? { id: who.user.id, email: who.user.email } : null;
    if (!user) return json({ error: 'signed_out' });

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, noSession);
    const anon = () => createClient(url, anonKey, noSession);
    const body = await req.json().catch(() => ({}));

    const result = await handle(body.action, body.code, {
      user,
      now: () => Date.now(),
      getRequest: async () => {
        const { data } = await admin.from('deletion_requests').select('created_at, attempts').eq('user_id', user.id).maybeSingle();
        return data ? { created_at: Date.parse(data.created_at), attempts: data.attempts } : null;
      },
      putRequest: async (r: { created_at: number; attempts: number }) => {
        await admin.from('deletion_requests').upsert({ user_id: user.id, created_at: new Date(r.created_at).toISOString(), attempts: r.attempts });
      },
      dropRequest: async () => { await admin.from('deletion_requests').delete().eq('user_id', user.id); },
      sendCode: async (email: string) => {
        const { error } = await anon().auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
        if (!error) return { ok: true };
        return error.status === 429 ? { wait: true } : { error: true };
      },
      checkCode: async (email: string, code: string) => {
        const { data, error } = await anon().auth.verifyOtp({ email, token: code, type: 'email' });
        return !error && !!data.user && data.user.id === user.id;
      },
      deleteAll: async () => {
        const save = await admin.from('cloud_saves').delete().eq('user_id', user.id);
        if (save.error) return false;
        const gone = await admin.auth.admin.deleteUser(user.id);
        if (gone.error) return false;
        // A note that a deletion happened: the date only, nothing about who
        await admin.from('deletion_log').insert({});
        return true;
      },
    });
    return json(result);
  } catch (_e) {
    return json({ error: 'server' });
  }
});
