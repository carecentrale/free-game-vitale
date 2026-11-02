# Parent link: letting a parent see their child's stats

Status: DECISIONS RECORDED (parent's answers, 2 Nov 2026). Not built yet. Chat question still open.

## Goal
A parent can see the stats for the child's device (not all players), by linking with a short code.

## Proposed flow
1. The parent signs in on the parent stats page with their own email code (already works).
2. The parent taps "Add a child" and gets a one-time code, for example `K7-Q2M9`, valid 10 minutes.
3. On the child's device, the parent area (the hidden corner-tap panel) has "Link to a parent". The parent (or the child, with a parent present) types the code.
4. The link is stored as a pair: parent account and device code. The parent sees that device's stats only.
5. The parent can unlink any device at any time, and the code is used once.

## Data
- New table `family_links`: parent_user_id (from sign-in), player_id (device code), created_at, expires_at (null until linked).
- No name, no photo, no email is stored on the child's side. The device code is the same random code already used.
- The stored link lets the parent read that device's rows in `game_events` and `game_errors`. Nothing else is shared.

## Privacy checks (must be decided by the parent)
- This connects a parent's account to a child's play data. Treat it as a consent change: review against docs/privacy-policy.md before release.
- Child-side: the child does not sign in and is not asked for anything. The code is typed by a grown-up.
- Are the links kept after the child's data is deleted? Proposed: deleting a device's data also deletes its links.
- Retention: links last until the parent unlinks, or 12 months of no sign-in, whichever is first. Proposed.

## Decisions made (2 Nov 2026)
1. Up to two parent accounts per child device.
2. Share link is one-use and expires after 24 hours. It can be shared by text, email or social apps.
3. The parent sees, for that device: time played, number of sessions (times the game was opened), and the dates. Nothing about other players.
4. The "link to a parent" prompt appears after character creation and is shown to everyone. The prompt only offers linking. Linking requires a parent to sign in and create the link.
5. The admin (yammay@gmail.com) can see every link, disconnect any link, and block any account from linking or signing in to the stats page. Blocked accounts are kept in a `blocked_accounts` table with a reason and date.

## Open question
- Chat (decided 2 Nov 2026): chat is NOT allowed for children. It is possible only between parents who have verified their identity. Not built. Before any work: a separate design, identity-verification method, moderation and reporting plan, a privacy review, and a check against Google Play's policies for family apps (which restrict chat in child-directed apps).
- Chat logs for linked parents: not decided. Recommended: do not show chat logs to parents. Decide with the chat design above.

## Decisions needed (earlier list, kept for reference)
1. One parent or two? (Proposed: up to two parent accounts per child device.)
2. Is the code entered by the parent or the child? (Proposed: the parent types it.)
3. What the parent sees: the stats page for that device only, or also the enemy log for its world? (Proposed: stats only.)
4. Should the admin account (yammay@gmail.com) also see all devices? (Proposed: yes, as now.)
5. Should the admin page still create accounts for any email? (Proposed: no. Only the listed parent emails may sign in. This needs a Supabase setting change.)

## Not included yet
- Share link (URL) option: you said either the code or a share link is fine. A share link would be a one-use address that the parent opens to link the device. It has the same privacy checks. Tell me if you want the share link as well.
