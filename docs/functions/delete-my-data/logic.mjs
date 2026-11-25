// Delete my data (SPEC-010): the rules, kept apart from the server plumbing so they can be tested (scripts/tests/delete-my-data.test.mjs).
// A signed-in parent asks for a code, then sends it back. Nothing is deleted before the right code arrives.
export const CODE_MINUTES = 15;   // a code ends after this long
export const MAX_TRIES = 5;       // this many wrong codes cancel the request

// d (what the server gives): user { id, email }, now() in ms, getRequest(), putRequest({ created_at, attempts }), dropRequest(),
// sendCode(email) -> { ok } or { wait: true } or { error }, checkCode(email, code) -> true or false, deleteAll() -> true or false
export async function handle(action, code, d) {
  const email = d.user && d.user.email;
  if (!d.user || !d.user.id) return { error: 'signed_out' };
  if (!email) return { error: 'no_email' };

  if (action === 'request') {
    const sent = await d.sendCode(email);
    if (!sent || !sent.ok) { await d.dropRequest(); return { error: sent && sent.wait ? 'wait' : 'send_failed' }; }
    await d.putRequest({ created_at: d.now(), attempts: 0 });
    return { ok: true, minutes: CODE_MINUTES };
  }

  if (action === 'confirm') {
    const req = await d.getRequest();
    if (!req) return { error: 'no_request' };
    if (d.now() - req.created_at > CODE_MINUTES * 60 * 1000) { await d.dropRequest(); return { error: 'expired' }; }
    const right = /^\d{6}$/.test(String(code || '')) && await d.checkCode(email, String(code));
    if (!right) {
      const attempts = req.attempts + 1;
      if (attempts >= MAX_TRIES) { await d.dropRequest(); return { error: 'cancelled' }; }
      await d.putRequest({ created_at: req.created_at, attempts });
      return { error: 'wrong', left: MAX_TRIES - attempts };
    }
    // The code works once: the request is dropped before anything is deleted
    await d.dropRequest();
    return (await d.deleteAll()) ? { ok: true, deleted: true } : { error: 'delete_failed' };
  }
  return { error: 'bad_action' };
}
