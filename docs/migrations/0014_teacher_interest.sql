-- 0014: Teachers who ask to hear when the teacher area opens (SPEC-032, approved by the owner on 23 Nov 2026).
-- Adults only (teachers and school staff). No child data of any kind.
--   teacher_interest: the list. Only checked emails go on it. Name, school, country, school email, the consent wording
--     that was shown, the date it was given and the date the email was checked, and a random unsubscribe token.
--     Kept until the person unsubscribes or asks to be deleted. Only the owner's account can read or delete it; the
--     public site key cannot touch it. Rows are written only by the backend function teacher-interest (service key).
--   teacher_interest_requests: a request waiting for its 6-digit code. The code is kept only as a hash, works 15 minutes
--     and 5 tries. Deleted after 24 hours. No one but the backend function can touch it.
--   teacher_code_sends: when a code was sent, for the limits (3 an hour per email, 10 an hour per network address).
--     The network address is kept only as a hash. Deleted after 24 hours.
--   owner_text_settings: owner-only text settings. Today one: mail_address, the mailing address every news email shows
--     (CASL and CAN-SPAM). No news email can be sent while it is empty.
--   teacher_interest_cleanup(): deletes requests and sends older than 24 hours. Run every hour by pg_cron, and by the
--     backend function on every call.
create table if not exists public.teacher_interest (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 80),
  school text not null check (char_length(school) between 1 and 80),
  country text not null check (country in ('CA', 'US')),
  email text not null unique check (char_length(email) between 3 and 200),
  consent_text text not null,
  consent_at timestamptz not null,
  verified_at timestamptz not null default now(),
  unsub_token text not null unique default encode(extensions.gen_random_bytes(24), 'hex')
);
alter table public.teacher_interest enable row level security;
drop policy if exists "owner reads teacher interest" on public.teacher_interest;
create policy "owner reads teacher interest" on public.teacher_interest
  for select to authenticated using ((auth.jwt() ->> 'email') = 'yammay@gmail.com');
drop policy if exists "owner deletes teacher interest" on public.teacher_interest;
create policy "owner deletes teacher interest" on public.teacher_interest
  for delete to authenticated using ((auth.jwt() ->> 'email') = 'yammay@gmail.com');
revoke all on public.teacher_interest from anon;
revoke insert, update, truncate on public.teacher_interest from authenticated;
grant select, delete on public.teacher_interest to authenticated;

create table if not exists public.teacher_interest_requests (
  email text primary key,
  name text not null check (char_length(name) between 1 and 80),
  school text not null check (char_length(school) between 1 and 80),
  country text not null check (country in ('CA', 'US')),
  consent_text text not null,
  code_hash text not null,
  tries int not null default 0,
  created_at timestamptz not null default now(),
  code_at timestamptz not null default now()
);
alter table public.teacher_interest_requests enable row level security;
revoke all on public.teacher_interest_requests from anon, authenticated;

create table if not exists public.teacher_code_sends (
  id bigint generated always as identity primary key,
  email text not null,
  ip_hash text not null,
  sent_at timestamptz not null default now()
);
alter table public.teacher_code_sends enable row level security;
revoke all on public.teacher_code_sends from anon, authenticated;

create table if not exists public.owner_text_settings (
  key text primary key check (key in ('mail_address')),
  value text not null default '' check (char_length(value) <= 300),
  updated_at timestamptz not null default now()
);
alter table public.owner_text_settings enable row level security;
drop policy if exists "owner reads text settings" on public.owner_text_settings;
create policy "owner reads text settings" on public.owner_text_settings
  for select to authenticated using ((auth.jwt() ->> 'email') = 'yammay@gmail.com');
drop policy if exists "owner changes text settings" on public.owner_text_settings;
create policy "owner changes text settings" on public.owner_text_settings
  for update to authenticated
  using ((auth.jwt() ->> 'email') = 'yammay@gmail.com') with check ((auth.jwt() ->> 'email') = 'yammay@gmail.com');
revoke all on public.owner_text_settings from anon;
revoke insert, delete, truncate on public.owner_text_settings from authenticated;
grant select, update (value, updated_at) on public.owner_text_settings to authenticated;
insert into public.owner_text_settings (key, value)
  values ('mail_address', '4725 Gouin East, Montréal, Quebec. Contact: yammay@gmail.com') on conflict (key) do nothing;

create or replace function public.teacher_interest_cleanup() returns void
language sql security definer set search_path = public as $$
  delete from public.teacher_interest_requests where created_at < now() - interval '24 hours';
  delete from public.teacher_code_sends where sent_at < now() - interval '24 hours';
$$;
revoke all on function public.teacher_interest_cleanup() from public, anon, authenticated;
grant execute on function public.teacher_interest_cleanup() to service_role;

create extension if not exists pg_cron;
select cron.schedule('teacher-interest-cleanup', '17 * * * *', 'select public.teacher_interest_cleanup()');
