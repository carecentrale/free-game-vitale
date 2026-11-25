-- 0019: Bird facts written by AI (SPEC-037, approved by the owner 24 Nov 2026).
-- What it does, in plain words:
--   1. bird_facts: the pool of fun facts about the game's eight kinds of bird. Each fact has five reading versions
--      (v1 for Words levels 1 to 20 ... v5 for 81 to 100), a status (approved, rejected, held, removed) and, when it was
--      rejected, the reason. It is game content: nothing about any child or player is in it.
--      A game can read approved facts only. Only the backend function "bird-facts" (docs/functions/bird-facts) adds
--      facts; only the owner's account can see the others and change a fact's status.
--   2. A fact that three different visits have flagged (a report of kind 'ai', SPEC-038) is held: it leaves the pool
--      until the owner looks at it.
--   3. facts_per_day: a game setting, how many new facts the function may write in a day (1 to 200, starts at 50).
create table if not exists public.bird_facts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('songbird', 'parrot', 'owl', 'duck', 'penguin', 'gull', 'geese', 'hawk')),
  place text check (char_length(place) <= 60),
  v1 text not null check (char_length(v1) <= 200), v2 text not null check (char_length(v2) <= 200), v3 text not null check (char_length(v3) <= 200),
  v4 text not null check (char_length(v4) <= 200), v5 text not null check (char_length(v5) <= 200),
  status text not null default 'rejected' check (status in ('approved', 'rejected', 'held', 'removed')),
  reason text check (char_length(reason) <= 300)
);
create index if not exists bird_facts_status on public.bird_facts (status, kind);
alter table public.bird_facts enable row level security;
revoke all on public.bird_facts from anon, authenticated;
grant select (id, kind, v1, v2, v3, v4, v5, status) on public.bird_facts to anon;
grant select, update on public.bird_facts to authenticated;
drop policy if exists "games read approved bird facts" on public.bird_facts;
create policy "games read approved bird facts" on public.bird_facts
  for select to anon, authenticated using (status = 'approved' or (auth.jwt() ->> 'email') = 'yammay@gmail.com');
drop policy if exists "owner changes bird facts" on public.bird_facts;
create policy "owner changes bird facts" on public.bird_facts
  for update to authenticated using ((auth.jwt() ->> 'email') = 'yammay@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'yammay@gmail.com');

-- Three flags from different visits hold a fact
create or replace function public.bird_fact_flagged() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'ai' and new.ai_line ~ '^[0-9]{1,12}$' then
    if (select count(distinct reporter) from public.reports where kind = 'ai' and ai_line = new.ai_line) >= 3 then
      update public.bird_facts set status = 'held', reason = 'flagged by 3 visits' where id = new.ai_line::bigint and status = 'approved';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists bird_fact_flagged on public.reports;
create trigger bird_fact_flagged after insert on public.reports for each row execute function public.bird_fact_flagged();

alter table public.game_settings drop constraint if exists game_settings_key_check;
alter table public.game_settings add constraint game_settings_key_check
  check (key in ('castle_gap', 'quiz_m1', 'quiz_m2', 'quiz_m3', 'quiz_m4', 'quiz_m5', 'force_update_days',
    'carts_max', 'guard_max', 'guard_step1', 'guard_step2', 'guard_step3', 'guard_step4',
    'mp_castle_stone', 'mp_roof_tile', 'mp_roof_tile_blue', 'mp_wood_floor', 'mp_pale_stone', 'mp_sandstone', 'mp_dark_stone',
    'mp_slate_roof', 'mp_window', 'mp_iron_bars', 'mp_pick', 'mp_wood_sword', 'mp_leather_armor', 'mp_iron_sword',
    'mp_iron_helmet', 'mp_gold_sword', 'mp_parts', 'ms_dirt', 'ms_stone', 'ms_castle_stone',
    'share_on', 'share_gems', 'reports_keep_months',
    'mirelo_visit_min', 'mirelo_stay_min', 'mirelo_away_hours', 'mirelo_unlock_min', 'mirelo_retry_min',
    'dragon_w_drake', 'dragon_w_wyvern', 'dragon_w_great', 'dragon_w_family', 'dragon_rare_pct', 'dragon_gap',
    'facts_per_day'));
alter table public.game_settings drop constraint if exists facts_range;
alter table public.game_settings add constraint facts_range check (key <> 'facts_per_day' or value between 1 and 200);
insert into public.game_settings (key, value) values ('facts_per_day', 50) on conflict (key) do nothing;
