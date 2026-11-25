-- 0022: A note of every run of an AI writer (Nick's request in chat, 25 Nov 2026: when the Anthropic key is out of
-- credit, capped or not working, "we have to take note of that and track it properly").
-- What it does, in plain words: a small table that a backend function writes one row to each time it asks the AI
-- service for content: which job (today only "bird-facts"; later jobs use the same table), when, who started it (the
-- weekly schedule or the owner's button), whether it worked, how many pieces it wrote, and, when it failed, the AI
-- service's own short reason (for example "credit balance is too low"). Only the owner's account can read it; games
-- cannot. Nothing about any player is in it. Rows older than a year are removed by the function.
create table if not exists public.ai_runs (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  job text not null check (char_length(job) between 1 and 40),
  source text not null check (source in ('weekly', 'owner')),
  ok boolean not null,
  made integer not null default 0, approved integer not null default 0, rejected integer not null default 0,
  why text check (char_length(why) <= 120)
);
create index if not exists ai_runs_at on public.ai_runs (job, at desc);
alter table public.ai_runs enable row level security;
revoke all on public.ai_runs from anon, authenticated;
grant select on public.ai_runs to authenticated;
create policy "owner reads ai runs" on public.ai_runs
  for select to authenticated using ((auth.jwt() ->> 'email') = 'yammay@gmail.com');
