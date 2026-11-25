# Database migrations (Supabase project rsrmuruskjtnxqmzvmnl)

Every change to the database's structure or access rules, in the order it was applied to the live database.
Run them in this order on an empty Supabase project to rebuild the structure. They hold **no player data**:
the data itself (worlds, players, cloud saves, logs) is not backed up here, and must never be put in this public repository.

Checked on 22 Nov 2026: each file below has the same text as the step recorded in the live database
(`supabase_migrations.schema_migrations`), comments and spacing aside.

| Order | File | Name in the live database | Applied |
|---|---|---|---|
| 1 | 0001a_create_shared_world_tables.sql | create_shared_world_tables | 30 Oct 2026 |
| 2 | 0001b_add_stats_and_error_tables.sql | add_stats_and_error_tables | 30 Oct 2026 |
| 3 | 0001c_add_cloud_saves.sql | add_cloud_saves | 30 Oct 2026 |
| 4 | 0002_debug_log.sql | 0002_debug_log | 2 Nov 2026 |
| 5 | 0003_debug_log_revoke_anon.sql | 0003_debug_log_revoke_anon | 2 Nov 2026 |
| 6 | 0004_purge_debug_log_invoker.sql | 0004_purge_debug_log_invoker | 2 Nov 2026 |
| 7 | 0005_signed_in_game_writes.sql | 0005_signed_in_game_writes | 2 Nov 2026 |
| 8 | 0006_cloud_save_delete.sql | cloud_save_delete | 2 Nov 2026 |
| 9 | 0007_lockdown.sql | 0007_lockdown | 11 Nov 2026 |
| 10 | 0009_delete_my_data.sql | delete_my_data | 18 Nov 2026 |
| 11 | 0009_game_settings.sql | 0009_game_settings | 20 Nov 2026 |
| 12 | 0010_quiz_badges.sql | 0010_quiz_badges | 20 Nov 2026 |
| 13 | 0011_force_update_days.sql | 0011_force_update_days | 22 Nov 2026 |
| 14 | 0012_merchant_settings.sql | 0012_merchant_settings | 22 Nov 2026 |
| 15 | 0013_share_reward.sql | 0013_share_reward | 23 Nov 2026 (Nick: "yes") |
| 16 | 0014_teacher_interest.sql | 0014_teacher_interest | 23 Nov 2026 (Nick: "yes") |
| 17 | 0015_reports.sql | 0015_reports | 25 Nov 2026 (Nick: "yes do data base changes") |
| 18 | 0017_mirelo_settings.sql | 0017_mirelo_settings | 25 Nov 2026 (Nick: "Yes apply migrations"). Applied before 0016: the 0016 step timed out waiting for a confirmation in the Supabase connection |

**Not applied:** `0008_guardian_packages.sql` (purchases, waits for the parent's approval). Its tables are not in the live database.
`0018_dragons.sql` (SPEC-033 and SPEC-036: dragon rarity weights, the landing distance and the owner's dragon names: written 25 Nov 2026, approved by Nick 25 Nov 2026, not applied yet; the game uses the starting weights until then).
`0021_bird_facts_weekly.sql` (SPEC-037, the weekly run of the bird-facts function, with a secret kept in the database's vault: written 25 Nov 2026, approved by Nick the same day, not applied yet).
`0020_insights.sql` (SPEC-040, two owner-only counting functions for the admin page's Insights: written 25 Nov 2026, approved by Nick 25 Nov 2026, not applied yet; until then Insights says it is not available).
`0019_bird_facts.sql` (SPEC-037, the bird facts table, the three-flags rule and the daily limit: written 25 Nov 2026, approved by Nick 25 Nov 2026, not applied yet; until then the game has no facts and a bird's card shows its picture and name only).
`0016_report_keys.sql` (Delete my data also deletes a device's reports: written 25 Nov 2026, approved by Nick 25 Nov 2026, not applied yet).

Two files start with 0009: delete_my_data was written on the 0.6.70 branch at the same time as game_settings.
Keep the order of the table, not of the file names.

Rules: a new step gets the next free number, is written here first, and is listed in this table when it is applied.
After applying one, check that the live list (`list_migrations`) and this table still match.
