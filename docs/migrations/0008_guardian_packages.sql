-- 0008: Packages, guardian packages and the daily chest (purchase system, step 1).
-- NOT APPLIED until the parent approves. See docs/SUPPORTER_PACKAGES.md.
--
-- What it does, in plain words:
--   1. packages: one row per package (Free, Monthly, Lifetime). Anyone can read the active ones (the game shows what each gives).
--      Only the parent admin can change them. Each package is for families or schools, so a school plan can be added later.
--   2. guardian_packages: which package each guardian (parent or legal guardian account) has, bought or granted. A guardian can read only their own rows.
--      Only the server (after checking the purchase with Google) and the parent admin can add or change rows. The game cannot.
--   3. claim_chest(): a signed-in guardian with a package opens the daily chest. The server works out the gems, so the game cannot give itself gems.
-- Nothing about children is stored. Rows belong to the guardian's (or later the teacher's) sign-in account.

-- ---- 1. Packages ----
create table if not exists public.packages (
  id text primary key check (id ~ '^[a-z0-9_-]{2,40}$'),
  name text not null check (char_length(name) <= 60),
  audience text not null default 'family' check (audience in ('family', 'school')),
  kind text not null check (kind in ('free', 'subscription', 'one_time', 'grant')),
  active boolean not null default true,
  play_product_id text check (play_product_id is null or play_product_id ~ '^[a-z0-9_.]{1,100}$'),
  play_option_id text check (play_option_id is null or play_option_id ~ '^[a-z0-9-]{1,63}$'),
  display_price text check (display_price is null or char_length(display_price) <= 30),
  icon text check (icon is null or char_length(icon) <= 200),
  extra_cloud_saves int not null default 0 check (extra_cloud_saves between 0 and 100),
  gems_once int not null default 0 check (gems_once between 0 and 100000),
  gems_daily int not null default 0 check (gems_daily between 0 and 10000),
  gems_accumulate boolean not null default false,   -- true: an unopened chest grows by gems_daily each day; false: it stays at gems_daily
  locked_saves_keep_days int not null default 365 check (locked_saves_keep_days between 0 and 3650),
  sort int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.packages enable row level security;

insert into public.packages (id, name, audience, kind, play_product_id, play_option_id, display_price, icon, extra_cloud_saves, gems_once, gems_daily, gems_accumulate, sort) values
  ('free',     'Free',                 'family', 'free',         null,                 null,             null,      null,                                   0,    0,  0, false, 0),
  ('monthly',  'Supporter (monthly)',  'family', 'subscription', 'supporter_monthly',  'monthly',        '$5.00',   'assets/store/supporter-monthly.png',   4,    0, 50, true,  1),
  ('lifetime', 'Supporter (lifetime)', 'family', 'one_time',     'supporter_lifetime', 'buy-lifetime-1', '$100.00', 'assets/store/supporter-lifetime.png',  4, 1000, 50, false, 2)
on conflict (id) do nothing;

drop policy if exists "anyone reads active packages" on public.packages;
create policy "anyone reads active packages" on public.packages
  for select to anon, authenticated using (active);
drop policy if exists "parent admin manages packages" on public.packages;
create policy "parent admin manages packages" on public.packages
  for all to authenticated
  using ((auth.jwt() ->> 'email') = 'yammay@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'yammay@gmail.com');

-- ---- 2. Guardian packages ----
create table if not exists public.guardian_packages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  package_id text not null references public.packages(id),
  status text not null default 'active' check (status in ('active', 'ended', 'granted', 'refunded')),
  source text not null check (source in ('google_play', 'admin_grant')),
  started_at timestamptz not null default now(),
  ends_at timestamptz,                          -- monthly: end of the paid period; lifetime and grants: empty
  last_chest_at timestamptz,                    -- when the daily chest was last opened (empty: never)
  once_gems_given boolean not null default false,
  play_purchase_token text unique,              -- used only by the server to check the purchase with Google; never shown in the game
  play_order_id text,
  admin_note text check (admin_note is null or char_length(admin_note) <= 200),   -- keep it short; no personal or financial details
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists guardian_packages_user_idx on public.guardian_packages(user_id);
alter table public.guardian_packages enable row level security;

drop policy if exists "guardian reads own package rows" on public.guardian_packages;
create policy "guardian reads own package rows" on public.guardian_packages
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "parent admin manages guardian packages" on public.guardian_packages;
create policy "parent admin manages guardian packages" on public.guardian_packages
  for all to authenticated
  using ((auth.jwt() ->> 'email') = 'yammay@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'yammay@gmail.com');
-- The purchase token is not readable by the guardian through the API (only the server needs it)
revoke select on public.guardian_packages from anon, authenticated;
grant select (id, user_id, package_id, status, source, started_at, ends_at, last_chest_at, once_gems_given, play_order_id, admin_note, created_at, updated_at)
  on public.guardian_packages to authenticated;

-- ---- 3. Daily chest ----
-- Returns the gems to add to the game, or 0 if the guardian has no active package with a chest, or the chest was already opened today.
-- Days are counted in UTC. Monthly: the chest grows by gems_daily for each day since it was last opened (or since the start). Lifetime: always gems_daily.
-- The one-time gems (lifetime: 1,000) are added to the first chest.
create or replace function public.claim_chest()
returns table(gems int, once_gems int, next_chest_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  s record; p record; days int; g int := 0; o int := 0; today date := (now() at time zone 'utc')::date;
begin
  if auth.uid() is null then return query select 0, 0, null::timestamptz; return; end if;
  select su.* into s from public.guardian_packages su
   where su.user_id = auth.uid() and su.status in ('active', 'granted') and (su.ends_at is null or su.ends_at > now())
   order by su.started_at desc limit 1 for update;
  if not found then return query select 0, 0, null::timestamptz; return; end if;
  select pk.* into p from public.packages pk where pk.id = s.package_id;
  if p.gems_daily <= 0 and (p.gems_once <= 0 or s.once_gems_given) then return query select 0, 0, null::timestamptz; return; end if;
  if s.last_chest_at is not null and (s.last_chest_at at time zone 'utc')::date >= today then
    return query select 0, 0, ((today + 1)::timestamp at time zone 'utc'); return;
  end if;
  if p.gems_accumulate then
    days := today - coalesce((s.last_chest_at at time zone 'utc')::date, (s.started_at at time zone 'utc')::date - 1);
    g := p.gems_daily * greatest(days, 1);
  else
    g := p.gems_daily;
  end if;
  if not s.once_gems_given then o := p.gems_once; end if;
  update public.guardian_packages set last_chest_at = now(), once_gems_given = true, updated_at = now() where id = s.id;
  return query select g, o, ((today + 1)::timestamp at time zone 'utc');
end $$;
revoke all on function public.claim_chest() from public, anon;
grant execute on function public.claim_chest() to authenticated;
