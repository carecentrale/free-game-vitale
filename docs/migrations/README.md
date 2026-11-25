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
| 19 | 0016_report_keys.sql | 0016_report_keys | 25 Nov 2026 (Nick: "Yes apply migrations") |
| 20 | 0018_dragons.sql | 0018_dragons | 25 Nov 2026 (the same yes) |
| 21 | 0019_bird_facts.sql | 0019_bird_facts | 25 Nov 2026 (the same yes) |
| 22 | 0020_insights.sql | 0020_insights | 25 Nov 2026 (the same yes) |
| 23 | 0021_bird_facts_weekly.sql | 0021_bird_facts_weekly | 25 Nov 2026 (Nick: "weekly push to add more automatically"). The function `bird-facts` was deployed the same day (version 3) |

`0022_ai_runs.sql` (a note of every run of an AI writer, asked for by Nick 25 Nov 2026: written and approved that day, not applied yet because the Supabase connection's confirmation question got no answer; until then the function `bird-facts` runs without leaving its note).

**Not applied:** `0008_guardian_packages.sql` (purchases, waits for the parent's approval). Its tables are not in the live database.

Two files start with 0009: delete_my_data was written on the 0.6.70 branch at the same time as game_settings.
Keep the order of the table, not of the file names.

Rules: a new step gets the next free number, is written here first, and is listed in this table when it is applied.
After applying one, check that the live list (`list_migrations`) and this table still match.
