-- 0001a: Shared worlds (live name: create_shared_world_tables, applied 30 Oct 2026).
-- Copied on 22 Nov 2026 from the live database's own migration history (supabase_migrations.schema_migrations),
-- word for word. It was applied from a chat and never saved here before.
-- Later steps changed these access rules: see 0005_signed_in_game_writes and 0007_lockdown.
create table public.worlds (
  id text primary key,
  grid text not null,
  updated_at timestamptz not null default now()
);

create table public.players (
  world_id text not null references public.worlds(id) on delete cascade,
  player_id text not null,
  name text not null check (char_length(name) <= 40),
  x double precision not null default 0,
  y double precision not null default 0,
  z double precision not null default 0,
  yaw double precision not null default 0,
  updated_at timestamptz not null default now(),
  primary key (world_id, player_id)
);

alter table public.worlds enable row level security;
alter table public.players enable row level security;

create policy "anon can read worlds" on public.worlds for select to anon using (true);
create policy "anon can write worlds" on public.worlds for insert to anon with check (true);
create policy "anon can update worlds" on public.worlds for update to anon using (true) with check (true);

create policy "anon can read players" on public.players for select to anon using (true);
create policy "anon can write players" on public.players for insert to anon with check (true);
create policy "anon can update players" on public.players for update to anon using (true) with check (true);
create policy "anon can delete players" on public.players for delete to anon using (true);

insert into public.worlds (id, grid) values ('main', '');
