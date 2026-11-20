-- 0009: Game settings set by the owner in the admin page (SPEC-016 part G, 20 Nov 2026).
-- One row per setting. Today there is one: castle_gap, the castle spacing X in blocks (one castle about every X blocks).
-- Everyone can read it (the game reads it when a new world is started). Only the owner's account can change it.
-- It holds nothing about any player.
create table if not exists public.game_settings (
  key text primary key check (key in ('castle_gap')),
  value int not null,
  updated_at timestamptz not null default now(),
  constraint castle_gap_range check (key <> 'castle_gap' or value between 250 and 2000)
);
alter table public.game_settings enable row level security;

insert into public.game_settings (key, value) values ('castle_gap', 500) on conflict (key) do nothing;

drop policy if exists "anyone reads game settings" on public.game_settings;
create policy "anyone reads game settings" on public.game_settings
  for select to anon, authenticated using (true);
drop policy if exists "owner changes game settings" on public.game_settings;
create policy "owner changes game settings" on public.game_settings
  for update to authenticated
  using ((auth.jwt() ->> 'email') = 'yammay@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'yammay@gmail.com');
revoke insert, delete, truncate on public.game_settings from anon, authenticated;
grant select on public.game_settings to anon, authenticated;
grant update (value, updated_at) on public.game_settings to authenticated;
