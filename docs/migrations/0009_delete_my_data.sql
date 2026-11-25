-- 0009: Delete my data (SPEC-010, 0.6.70).
-- What it does, in plain words:
--   1. deletion_requests: one row while a signed-in parent is being asked for the emailed code (at most 15 minutes).
--      It holds the account, the time and the number of wrong tries. It does not hold the code: the sign-in service does.
--      The row goes when the code is used, after 5 wrong tries, when it is too old, or with the account.
--   2. deletion_log: one row per finished deletion, with the date only. Nothing says who it was.
--   3. Neither table can be read or written by the game or by a signed-in parent: only the server function
--      "delete-my-data" (docs/functions/delete-my-data) uses them.
create table if not exists public.deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  attempts int not null default 0 check (attempts between 0 and 5)
);
alter table public.deletion_requests enable row level security;
revoke all on public.deletion_requests from anon, authenticated;

create table if not exists public.deletion_log (
  id bigint generated always as identity primary key,
  deleted_on date not null default current_date
);
alter table public.deletion_log enable row level security;
revoke all on public.deletion_log from anon, authenticated;
