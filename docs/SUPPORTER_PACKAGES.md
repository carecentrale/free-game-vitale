# Supporter packages: decisions and design

Status: DECIDED BY THE PARENT (11 Nov 2026). Purchase code, admin panel and server checks are NOT BUILT yet.
Purchases are Android only (Google Play billing). The website shows "available in the Android app".

## Packages

| | Free | Supporter monthly | Supporter lifetime |
|---|---|---|---|
| Google Play product ID | (none) | `supporter_monthly` (subscription), base plan `monthly` | `supporter_lifetime` (one-time product, not consumable), purchase option `buy-lifetime-1` (Buy, backwards compatible) |
| Price (set in Play Console, CAD) | free | $5.00 a month, auto-renewing | $100.00 once |
| Play Console icon | (none) | assets/store/supporter-monthly.png (chest with moon) | assets/store/supporter-lifetime.png (chest with star) |
| The game itself | yes | yes | yes |
| Saves on the device | unlimited | unlimited | unlimited |
| Cloud saves | 1 per parent account | extra | extra |
| Delete saves or child profile | yes (a privacy right, never paid) | yes | yes |
| Gems | earned by playing | daily chest of 50 | 1,000 once, plus the daily chest of 50 |
| Daily chest when not opened | (none) | gems add up (50 per day) until opened | stays at 50; does not grow |

Rules for the chest (both paid packages):
- There is only ever one chest. When it is claimed, the next one appears the following day.
- Fixed contents (never random), so it is not a loot box.
- No countdowns, no "you missed it" messages, no pressure. No buy button a child can reach.

When a monthly subscription ends:
- Extra cloud saves are kept, locked, for 1 year. Resubscribing within the year unlocks them.
- After 1 year they are deleted, with a warning to the parent first. The privacy policy must say this.

Low-income families: free Supporter access, granted by hand from the admin panel (not a Google product).

## Data (planned)

Table `packages` (one row per package; editable by the parent in the admin panel):
- id (free, monthly, lifetime), name, active (on/off)
- play_product_id (supporter_monthly / supporter_lifetime), play_option_id (base plan `monthly` / purchase option `buy-lifetime-1`), kind (subscription / one-time / none)
- display_price (text shown in the game; must match the Play Console price)
- icon (path of the store icon)
- extra_cloud_saves, gems_once, gems_daily, gems_accumulate (true for monthly, false for lifetime), locked_saves_keep_days (365)

Table `supporters` (one row per paying parent account; written only by the server and the parent admin, never by the game):
- parent_user_id, package_id, status (active, ended, granted), source (google_play, granted_by_admin)
- started_at, ends_at, last_chest_claimed_at, gems_waiting
- play_purchase_token (to check the purchase with Google; never shown in the game)

Nothing about the child is stored in either table.

## Rules for changing packages in the admin panel
- Prices are changed in the Play Console, not here. The panel shows a warning if display_price and the Play Console price differ.
- Giving more to existing supporters is fine. Giving less shows a warning first (store rules and the terms).
- Gems and cloud saves are granted by the server after it has checked the purchase with Google, never by the game on the device.

## Still to set up
- Google Play: both products created and active (11 Nov 2026). Still to do: payments profile; real-time developer notifications (Pub/Sub topic `play-billing`, all notifications) once the server receiver exists.
- Privacy policy and terms: describe purchases, the 1-year hold, and the parent gate; professional review.
- Build: parent gate, purchase screen (Android), server purchase check (Supabase), packages and supporters tables, admin panel page.
