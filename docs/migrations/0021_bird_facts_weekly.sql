-- 0021: New bird facts by themselves, once a week (SPEC-037; the owner's answer of 25 Nov 2026: "weekly push to add more
-- automatically").
-- What it does, in plain words:
--   1. Every Monday at 08:00, 08:10 and 08:20 (UTC) the database calls the backend function "bird-facts", which writes
--      and checks new facts until the day's limit (facts_per_day) or its time is used. Nothing about any player is in
--      the call: it says only "run".
--   2. The call carries a secret so that nobody else can start the function. The secret is made here, inside the
--      database, and kept in its vault: it is in no file, nobody ever sees it, and the function only asks the database
--      "is this the right one?" (bird_facts_cron_ok, which only the backend may run).
-- Needs the extension pg_net (the database's own way to call a web address). pg_cron and the vault are already on.
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'bird_facts_cron') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'bird_facts_cron',
      'Lets the weekly schedule start the bird-facts function (migration 0021)');
  end if;
end $$;

create or replace function public.bird_facts_cron_ok(p text) returns boolean
language sql stable security definer set search_path = public, vault as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'bird_facts_cron' and decrypted_secret = p);
$$;
revoke all on function public.bird_facts_cron_ok(text) from public, anon, authenticated;
grant execute on function public.bird_facts_cron_ok(text) to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'bird-facts-weekly';
select cron.schedule('bird-facts-weekly', '0,10,20 8 * * 1', $job$
  select net.http_post(
    url := 'https://rsrmuruskjtnxqmzvmnl.supabase.co/functions/v1/bird-facts',
    headers := jsonb_build_object('content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'bird_facts_cron')),
    body := '{"action":"run"}'::jsonb,
    timeout_milliseconds := 5000);
$job$);
