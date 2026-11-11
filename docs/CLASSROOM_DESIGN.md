# Classroom mode: design

Status: DECISIONS RECORDED (parent's answers, 11 Nov 2026). NOT BUILT.

## Goal
A teacher creates a classroom with its own class world and class code. Students join from the game with the code and play together.
The teacher manages the class completely from a teacher page on the website (never inside the child's game).

## Decisions made (11 Nov 2026)
1. Teachers are approved by hand. A teacher signs up and gives, for checking their credentials:
   their name and work email, the school's name, region (province or state, and country), the school's phone or contact address, and the school's website.
   The parent (game owner) checks these and approves or refuses the teacher in the admin panel. Only approved teachers can create classes.
2. Students: just a classroom. Students keep their preset game names; the game stores no real names, no seat numbers and no list of students.
   The teacher keeps track of who is who on their own.
3. Teacher controls in the first version:
   - See who is in the class world (live, preset names only) and remove a student
   - Lock or unlock joining
   - Reset the class world, or close the class (closing deletes the class world)
   - Freeze everyone (pause all students' characters, for example to get attention)
   - Send an invite link to a parent so the parent can join their child to the class (see "Parent invite link" below)
4. Price: free for teachers at first. A paid school plan may come later (to be decided).

## How it works (proposed)
- Teacher page: on the website, like the parent stats page. Sign-in with Google or an email code, adults only.
- A class has: the teacher account, a class code, the class world, joining open/locked, frozen yes/no, created and last-used dates.
- Class code: 6 or more characters (harder to guess than the 4-letter world codes).
- Students join in the game with "Join a class" and the code, or through the parent's invite link. No sign-in for children, no chat, no typed names.
- In class mode: no purchase offers, no Supporter screens, no links out of the game.
- Remove: the student's game leaves the class world and cannot rejoin until the teacher allows it again (until the code changes, or for that session).
- Freeze: the teacher's freeze is sent to every student's game in the class world; characters stop moving until unfrozen.

## Parent invite link (to decide in detail)
Proposed: the teacher page makes a link (for example .../play/?class=CODE). The teacher sends it to parents themselves (school email, class newsletter).
The game does NOT collect or store parents' email addresses for this. When a parent opens the link on the child's device, a parent gate appears,
then the child's game joins the class. This keeps parents involved and informed.
Open question: should joining a class ALWAYS need the parent's link (no typing the code by children)? Safer, but harder in a classroom setting.

## Data (planned)
- teachers: user_id (sign-in account), name, work email, school name, region, school contact, school website, status (pending, approved, refused, blocked), dates, reviewed_by
- classrooms: id, teacher_user_id, code, world_id, joining_locked, frozen, created_at, last_used_at, closed_at
- No student data. Live presence (preset name, character look, position) passes through the world channel as in shared worlds, and is not stored.
- Retention (proposed): a class unused for 12 months is closed and its world deleted, with a warning to the teacher first.

## Privacy and policy (must be done before release)
- Teacher information is adult personal data: describe it in the privacy policy (what, why, how long, who sees it: the game owner only).
- "Schools and teachers" section in the privacy policy and terms: the class is for educational use; the school/teacher consents for that use
  (children's privacy law allows a school to consent instead of each parent for educational use only, never commercial use).
- Play Console: Data safety must add the teacher sign-up details. Content rating: no change if there is still no chat.
- Teacher Approved: Google does not support apps "designed primarily for classroom use" or with social features between children. Classroom mode is an extra mode, but the game is unlikely to get the badge. The parent chose shared play over the badge (11 Nov 2026).
- Get the professional privacy review to cover classroom mode.

## Build order (proposed)
1. Database: teachers and classrooms tables, locked down like the rest (teachers see only their own classes; the parent admin sees all).
2. Admin panel: teacher applications list, approve / refuse / block.
3. Teacher page: sign up, create class, code and invite link, live list, remove, lock, freeze, reset, close.
4. Game: "Join a class", class mode (no purchases), freeze, removal, parent gate for invite links.
5. Tests for each rule, privacy policy update, then the parent tests it.
