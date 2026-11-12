# iHodim — v1 build plan

This plan is based only on the decisions in [CLAUDE.md](../CLAUDE.md). If the two disagree, CLAUDE.md wins. Nothing from its "Not in v1" list is in this plan: no chat, no club accounts, no bookings, no discounts, no QR check-in, no finding strangers, no public profiles and no native apps.

Some details are marked **(proposed)**. This plan suggests them and CLAUDE.md does not decide them, so each one is listed again in [Open questions](#e-open-questions). Confirm or change it before the phase that needs it.

**Contents:** [a) Data model](#a-data-model) · [b) Phases](#b-phases) · [c) Work split](#c-work-split) · [d) Risks](#d-risks) · [e) Open questions](#e-open-questions)

---

## a) Data model

All tables are in the `public` schema of the Supabase Postgres database. Every table has Row Level Security (RLS) enabled. A table with RLS enabled and no policy for an action denies that action to clients.

### Ground rules

- **"Member"** means a signed-in user who has finished sign-up: they have a `profiles` row, which only exists if they are 18+. Every rule below that says "members" also excludes users who signed in but never finished sign-up.
- **Blocking ends a friendship.** Every "friends only" rule therefore also hides content between blocked users, with no extra checks.
- **Some writes go only through RPC functions or Edge Functions:** friendship changes, profile creation and check-ins. The clients get no direct `insert`/`update` policy on those tables, so the rules live in one place.
- **Helper SQL functions** are used inside the policies. They are `security definer` and `stable`, so they can read the tables they check:
  - `is_member()`: the caller has a profile.
  - `is_admin()`: the caller's profile has `is_admin = true`.
  - `are_friends(a, b)`: there is a friendship row with `status = 'accepted'`.
  - `can_see_plan(plan_id)`: the caller is the creator, or is a friend of the creator and not listed in `plan_hidden_from`.
- **The service-role key is used only inside Edge Functions.** It never goes into the frontend or into `.env.example` with a value.
- **All timestamps are `timestamptz`.** Night and week logic runs in the `Europe/Sofia` time zone (see Phase 6).

### Tables

#### `profiles` — public identity
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | FK → `auth.users(id)` on delete cascade |
| `username` | `citext` unique not null | Case-insensitive. Length and character rules: see Q3 |
| `is_admin` | `boolean` not null default `false` | Set only by us with SQL. Clients can never change it |
| `stats_visibility` | enum `friends` / `hidden` not null | The default is Q19 |
| `created_at` | `timestamptz` default `now()` | |

- **Read:** your own row, your friends, and people you have a pending friend request with. People in a plan you can see also count, depending on Q9.
- **Read (search):** username search uses the `find_user_by_username(text)` RPC. It returns exact matches only, never a list, so it can't be used to browse for strangers. Blocked pairs never find each other.
- **Write:** the row is created only by the `complete-signup` Edge Function. The owner can update `username` and `stats_visibility`, which is enforced with column grants plus a policy. Nobody can update `is_admin` from a client.

`is_admin` and `stats_visibility` are added in Phase 1 so that no later phase has to alter this table.

#### `profile_private` — data only the owner sees
| Column | Type | Notes |
|---|---|---|
| `user_id` | `uuid` PK | FK → `profiles(id)` on delete cascade |
| `date_of_birth` | `date` not null | `CHECK (date_of_birth <= current_date - interval '18 years')` |

- **Read:** the owner only.
- **Write:** inserted once by `complete-signup`. No client updates (see Q4).
- **Why it's a separate table:** RLS works per row, not per column. Keeping the birth date out of `profiles` means a friend can read a profile without seeing the birth date.
- **The 18+ check is enforced by the database constraint.** A check in the form alone isn't enough. A `CHECK` with `current_date` is safe here because a person's age only goes up, so a row that passed once stays valid.

#### `friendships` — one row per pair of users
| Column | Type | Notes |
|---|---|---|
| `requester_id` | `uuid` | FK → `profiles` on delete cascade. For a block, this is the blocker |
| `addressee_id` | `uuid` | FK → `profiles` on delete cascade |
| `status` | enum `pending` / `accepted` / `blocked` | |
| `created_at`, `updated_at` | `timestamptz` | |

- **Constraints:** a unique index on `(least(requester_id, addressee_id), greatest(...))`, which allows one row per pair. Also `requester_id <> addressee_id`.
- **Read:** both users can see a `pending` or `accepted` row. A `blocked` row is visible only to the blocker (see Q12).
- **Write:** only through RPCs:
  - `send_friend_request`: fails if any row already exists for the pair.
  - `accept_request`: addressee only.
  - `decline_request` and `unfriend`: delete the row.
  - `block_user`: overwrites any existing row as `blocker → blocked, status = blocked`.
  - `unblock_user`: blocker only, deletes the row.

#### `venues` — entered by admins
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `name`, `address` | `text` not null | |
| `lat`, `lng` | `double precision` not null | Used for the map and the GPS check |
| `phone` | `text` not null | Used for the call button (`tel:` link) |
| `checkin_radius_m` | `integer` not null default `100` | Set per venue. `CHECK (> 0)` |
| `checkin_window_start` | `time` not null default `'22:00'` | Local Sofia time |
| `checkin_window_end` | `time` not null default `'04:00'` | May be earlier than the start, meaning the window crosses midnight. See Q14 |
| `created_by` | `uuid` | FK → `profiles` on delete set null |
| `created_at` | `timestamptz` | |

- **Read:** members.
- **Write:** admins only.

#### `events` — entered by admins
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `venue_id` | `uuid` not null | FK → `venues` on delete cascade |
| `performer` | `text` not null | |
| `starts_at` | `timestamptz` not null | |
| `promo` | `text` null | Free text about promos. Nothing is sold or discounted in the app |
| `created_by`, `created_at` | | Same as `venues` |

- **Read:** members.
- **Write:** admins only.

#### `plans`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `creator_id` | `uuid` not null | FK → `profiles` on delete cascade |
| `venue_id` | `uuid` not null | FK → `venues` on delete restrict. Whether a place must be a listed venue is Q8 |
| `event_id` | `uuid` null | FK → `events` on delete set null. A trigger checks that the event belongs to the same venue |
| `starts_at` | `timestamptz` not null | The date and time picked in Sofia time |
| `created_at` | `timestamptz` | |

- **Read:** `can_see_plan(id)`, meaning the creator plus the creator's friends who are not hidden from the plan.
- **Write:** any member can insert a plan with `creator_id = auth.uid()`. Only the creator can update or delete it (see Q11).

#### `plan_rsvps` — Going / Maybe / Out
| Column | Type | Notes |
|---|---|---|
| `plan_id` | `uuid` | FK → `plans` on delete cascade |
| `user_id` | `uuid` | FK → `profiles` on delete cascade |
| `status` | enum `going` / `maybe` / `out` | |
| `updated_at` | `timestamptz` | |

- **Primary key:** `(plan_id, user_id)`. One tap is an upsert of this row.
- **Read:** anyone who can see the plan. Whether they see RSVPs from people who aren't their friends is Q9. Until that's answered, they see only their own row, the creator's row and their friends' rows, plus a total count.
- **Write:** your own row only, and only if `can_see_plan`.
- **Realtime:** this table feeds the live "who's coming" list. Supabase Realtime applies RLS to each subscriber.

#### `plan_tags`
| Column | Type | Notes |
|---|---|---|
| `plan_id` | `uuid` | FK → `plans` on delete cascade |
| `tagged_user_id` | `uuid` | FK → `profiles` on delete cascade |
| `tagged_by` | `uuid` | FK → `profiles` on delete cascade |
| `status` | enum `pending` / `accepted` | |
| `created_at` | `timestamptz` | |

- **Primary key:** `(plan_id, tagged_user_id)`.
- **Read:** the tagger and the tagged person always see the row. Anyone else who can see the plan sees it only when `status = 'accepted'`. This is how "a tag shows only after the tagged person accepts" is enforced in the database.
- **Insert:** `tagged_by = auth.uid()` and the tagger is the plan creator (see Q10). The tagged person must be the creator's friend and must not be hidden from the plan.
- **Update and delete:** only the tagged person can change `pending → accepted`. The tagged person declines by deleting the row, and the tagger can remove a tag.

#### `plan_hidden_from`
| Column | Type | Notes |
|---|---|---|
| `plan_id` | `uuid` | FK → `plans` on delete cascade |
| `user_id` | `uuid` | FK → `profiles` on delete cascade |

- **Primary key:** `(plan_id, user_id)`.
- **Read and write:** the plan creator only. A hidden person can't learn that they're hidden, because they can't read this table, and to them the plan doesn't exist.

#### `checkins` — verified check-ins only
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` not null | FK → `profiles` on delete cascade |
| `venue_id` | `uuid` not null | FK → `venues` on delete restrict |
| `created_at` | `timestamptz` not null default `now()` | Server time. The client's clock is never used |
| `night_date` | `date` not null | The night this check-in belongs to (Phase 6) |
| `distance_m` | `integer` not null | Distance to the venue at verification time |
| `accuracy_m` | `integer` not null | Accuracy reported by the phone |
| `photo_path` | `text` not null | Object path in the private `checkin-photos` bucket |

- **Constraint (proposed, Q15):** unique on `(user_id, venue_id, night_date)`.
- **The user's raw GPS coordinates are not stored.** They're used only during verification. The distance and accuracy are kept so a disputed check-in can be checked. This follows GDPR's rule to store only what a feature needs.
- **Read:** the owner, and the owner's friends.
- **Write:** no client policies at all. Rows are inserted only by the `verify-checkin` Edge Function using the service role.
- **Photo access** is enforced by Storage policies on `storage.objects`, not by the UI:
  - The owner can always read their own photos.
  - A friend can read a photo only while `checkins.created_at > now() - interval '24 hours'`.
  - Clients have no upload policy, so only the Edge Function can write to the bucket.

#### `reports`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `reporter_id` | `uuid` null | FK → `profiles` on delete set null |
| `target_user_id` | `uuid` null | FK → `profiles` on delete cascade |
| `target_checkin_id` | `uuid` null | FK → `checkins` on delete cascade. This is a photo report |
| `reason` | `text` not null | Categories: see Q20 |
| `status` | enum `open` / `reviewed` | |
| `created_at`, `reviewed_at` | `timestamptz` | |
| `reviewed_by` | `uuid` null | FK → `profiles` on delete set null |

- **Constraint:** exactly one target is set.
- **Read:** the reporter sees their own reports. Admins see all reports.
- **Insert:** a member, with `reporter_id = auth.uid()`. The reporter must be able to see the target. For a photo, that means the reporter can read that check-in.
- **Update:** admins only, for `status` and the `reviewed_*` columns. The actions an admin can take are Q20.

### Streaks and stats: computed, not stored

Streaks and stats are **SQL functions over `checkins`, computed when they're read**, and there are no stored counters.
- **One source of truth.** A stored streak can drift away from the check-ins it was counted from, for example after a check-in or an account is deleted. A computed one can't.
- **The rules can still change.** The week boundary, the night rule and the definition of "top friends" are still partly open (Q16–Q18). Changing a function is a one-line migration. Changing a stored value means fixing existing data too.
- **The data is small.** At launch there are 5–6 venues and tens to hundreds of users, so computing on read is cheap. If it gets slow, we can add a materialized view later without changing the API.

The functions are:
- `venue_streaks(user_id)`
- `user_stats(user_id)`, which returns nights out, top venues and top friends

They are `security definer` and check access themselves. They return data only to the owner, or to a friend when `stats_visibility = 'friends'`. Top friends needs other people's check-ins, which the viewer can't always read through RLS. The `security definer` setting is why these functions can still count them.

---

## b) Phases

Sizes are relative effort for one person working part-time: **S** is a few evenings, **M** is about 1–2 weeks, and **L** is about 2–4 weeks. Every phase ends with a merged PR that passes CI. Every "done when" can be tested on a phone unless it says otherwise.

### Phase 0 — Project setup · M
**Goal:** an empty app that builds, is checked by CI and is live on a phone, with the database tooling ready.

**Tasks**
- Scaffold Vite + React + TypeScript with `strict: true`.
- Add ESLint and Prettier.
- Add Vitest with one sample test.
- Create `src/i18n/bg.ts` as the single Bulgarian strings file. The first page reads its title from it.
- Add a PWA manifest and icons so the app can be added to the home screen.
- Create the Supabase project in the **EU (Frankfurt)** region.
- Set up the Supabase CLI with `supabase/migrations/` and local `supabase start`.
- Generate TypeScript types from the database schema and commit them.
- Add `.env.example` with empty values: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The service-role key only ever goes into Edge Function secrets.
- Add a GitHub Actions workflow that runs typecheck, lint and test on every PR.
- Turn on branch protection on `main`: CI must pass and the other person must approve.
- Deploy the static build to the host we choose (Q1). It must be served over HTTPS, because camera and GPS need HTTPS.
- Run an **iPhone and Android spike**: a throwaway page that opens the camera and reads GPS, both in the browser and as an installed PWA (see risk R2).

**Done when**
- The deployed URL opens over HTTPS on an iPhone and an Android phone and shows the Bulgarian title from `bg.ts`.
- "Add to Home Screen" works on both phones.
- A PR with a lint or type error shows a red CI check and can't be merged.
- On a fresh clone, `cp .env.example .env`, `npm install` and `npm run dev` start the app.
- The spike results are written down in the PR: what works on each phone, and in the browser vs the installed PWA.

### Phase 1 — Auth and profile · M
**Goal:** only verified adults get into the app, each with a unique username.

**Tasks**
- Set up Supabase Auth with Google and email (the email method is Q5).
- Write the migration for `profiles` and `profile_private`, including `is_admin`, `stats_visibility`, the 18+ `CHECK` and the RLS policies.
- Add the `is_member()` and `is_admin()` helper functions.
- Build the onboarding screen for username and date of birth. Google doesn't give us a birth date, so everyone fills it in.
- Write the `complete-signup` Edge Function:
  - It validates the username and the birth date and creates both rows.
  - If the user is under 18, it deletes the auth user (Q6) and returns a rejection, which the UI shows in Bulgarian.
- Add route guards: no profile means only the onboarding screen.
- Add sign-out.

**Done when**
- Sign-in with Google works on a phone and leads to onboarding. Email sign-in works too.
- A birth date 17 years and 364 days ago is rejected with a Bulgarian message. Signing in again with that account doesn't get into the app.
- A birth date exactly 18 years ago is accepted.
- A username already taken in different letter case (`Ivan` vs `ivan`) is rejected.
- An API call that inserts an under-18 `profile_private` row directly fails. This is tested in SQL, not on the phone.
- A signed-in user with no profile gets nothing when reading `venues` from the API.

### Phase 2 — Friends · M
**Goal:** mutual friendships and blocking, enforced in the database.

**Tasks**
- Migration for `friendships`, the `are_friends()` helper and the friendship RPCs.
- Add the `find_user_by_username` RPC (exact match).
- Build the friends screen: search, incoming and outgoing requests, accept, decline, unfriend, and the friend list.
- Add block from a profile, plus a blocked-users list in settings with unblock.

**Done when**
- On phone A, searching phone B's exact username finds them. A partial username lists nobody.
- A sends a request and B sees it. B accepts, and both see each other in their friend lists.
- Declining and unfriending remove the friendship on both phones.
- After A blocks B:
  - B can't find A by username.
  - B can't send A a request.
  - Any friendship between them is gone.
- Through the API, a user can't create an `accepted` row or accept their own request.

### Phase 3 — Venues and events · M
**Goal:** admins add the launch venues and events, and members can see them and call the venue.

**Tasks**
- Migrations for `venues` and `events` with admin-only write policies.
- Build admin screens inside the app, visible only when `is_admin`:
  - venue create and edit, including coordinates, radius and check-in window
  - event create and edit
- Build the venue page: name, address, map location (the provider is Q22), a call button using a `tel:` link, and upcoming events showing performer, date and promo.
- Build the venue list.
- Set `is_admin` for Simeon and Givo with a seed or manual SQL. It is documented, never done from the client.

**Done when**
- An admin creates a venue on a phone and a normal member sees it straight away.
- A normal member sees no admin screens. A direct API insert into `venues` by that member fails.
- Tapping the call button opens the phone dialer with the venue's number.
- The map location opens the venue's real position.
- Upcoming events show on the venue page in date order. Past events don't.

### Phase 4 — Plans · L
**Goal:** the core loop of making a plan, getting RSVPs and seeing who's coming live.

**Tasks**
- Migrations for `plans`, `plan_rsvps`, `plan_tags`, `plan_hidden_from`, the `can_see_plan()` helper and a Realtime publication for `plan_rsvps` and `plan_tags`.
- Build the create-plan screen: venue, date and time, an optional event at that venue, friends to tag and friends to hide from.
- Build a plans feed: upcoming plans you can see.
- Build the plan page:
  - one-tap Going / Maybe / Out
  - the live list of who's coming, subscribed through Realtime
  - accept or decline a tag
- Add creator edit and delete (Q11).

**Done when**
- A creates a plan. Friend B sees it, and non-friend C doesn't, not even through the API.
- A hides the plan from friend D. D doesn't see it on the phone or through the API, and D can't tell it exists.
- B taps Going, and A's open plan page updates within a few seconds without a refresh.
- A tags B. B sees the pending tag, and friend E sees no tag. After B accepts, E sees B as tagged.
- A can't tag a non-friend or a friend the plan is hidden from (the API rejects both).
- Picking an event from a different venue is rejected.

### Phase 5 — Check-in · L
**Goal:** verified check-ins, with photos that disappear for others after 24 hours.

**Tasks**
- Migration for `checkins`.
- Create the private Storage bucket `checkin-photos` with read policies for the owner (always) and friends (within 24 hours), and no client uploads.
- Add a SQL helper `checkin_night(venue_id, ts)` that returns whether `ts` is inside the venue's window and which `night_date` it belongs to. It's shared with Phase 6.
- Build the camera screen:
  - live camera via `getUserMedia`, using the rear camera
  - capture one frame to a canvas and turn it into a JPEG, compressed to about 1280 px on the long side
  - **no file input and no gallery option anywhere**
- Read location with `watchPosition` and high accuracy for up to ~10 seconds and keep the most accurate fix.
- Write the `verify-checkin` Edge Function. It receives the photo, coordinates, accuracy and `venue_id` with the user's token, and does these steps in order:
  1. Check the caller is a member.
  2. Use the server time and check it's inside the venue's window.
  3. Compute the haversine distance and check it's ≤ `checkin_radius_m`. The accuracy rule is Q13.
  4. Check this isn't a second check-in at the venue on the same night (Q15).
  5. Check the image is a JPEG, decodes, and is under the size limit.
  6. Upload the photo with the service role and insert the row.
  7. Return a result code, which the UI maps to a Bulgarian message.
- Show check-ins on the owner's profile and in friends' views.

**Done when**
- At a venue inside its window, a check-in succeeds and the photo shows to a friend.
- At home, the check-in is rejected as too far away, with a Bulgarian message.
- At the venue outside the window (e.g. 18:00), it's rejected as outside the window.
- The check-in screen has no way to pick an existing photo.
- After 24 hours the friend no longer sees the photo, and a direct Storage request by the friend is refused. On a dev database, test this by moving `created_at` back. The owner still sees the photo on their profile.
- Calling the Edge Function with made-up coordinates far from the venue fails. Inserting into `checkins` directly with the user's key fails.

### Phase 6 — Streaks and stats · M
**Goal:** per-venue streaks and personal stats, with the visibility setting.

**Definitions (proposed: Q16, Q17)**
- **Time zone:** all night and week logic uses `Europe/Sofia`, including the switches to and from summer time.
- **Night of a check-in (`night_date`):** the Sofia date on which the venue's window **started**.
  - Example: with a 22:00–04:00 window, a check-in at 01:30 on Saturday belongs to **Friday** night.
  - If a window doesn't cross midnight, `night_date` is simply the check-in's date in Sofia.
- **Week:** Monday 00:00 to Sunday 24:00 in Sofia time (ISO week), worked out from `night_date`, not from the check-in time.
  - So a check-in at 01:00 on Monday morning, during Sunday night, counts in the week that just ended.
- **Streak (per venue):** the number of consecutive weeks with at least one verified check-in at that venue.
  - The current streak stays alive through the current week, so it doesn't drop to 0 on Monday morning.
  - It ends when a whole week passes with no check-in there.
- **Nights out:** the number of distinct `night_date` values with a verified check-in, at any venue.
- **Top venues:** venues ranked by the number of nights checked in.
- **Top friends:** the definition is open (Q18).

**Tasks**
- Add the `venue_streaks()` and `user_stats()` functions with their access checks.
- Show the streak on each venue page (for the viewer) and on the profile.
- Build a stats section on the profile.
- Add the visibility toggle in settings.
- Add SQL tests for the boundary cases:
  - the 01:30 Saturday case
  - the Sunday-night-into-Monday case
  - a 4-week streak, a broken streak and the current-week rule
  - the nights when summer time starts and ends

**Done when**
- Check-ins at the same venue in 4 consecutive weeks show "4 weeks" on the phone.
- Skipping a whole week resets the streak at the start of the following week.
- A Friday-night check-in made after midnight counts for Friday.
- With stats set to hidden, a friend sees no stats on the profile, and the API returns nothing for them either. With stats set to friends, the friend sees them.
- The boundary-case SQL tests pass in CI.

### Phase 7 — Safety and GDPR · M
**Goal:** users can report and leave completely, admins can review reports, and the privacy page is live.

**Tasks**
- Migration for `reports`.
- Add a report button on profiles and on check-in photos, with reason categories (Q20).
- Build an admin review list of open reports, oldest first, with "mark reviewed". Other actions depend on Q20.
- Write the `delete-account` Edge Function, which does these steps in order:
  1. Delete every photo object under the user's prefix. Storage objects are not deleted by database cascades.
  2. Delete the auth user, which cascades to the profile and every row the user owns.
- Add delete-account to settings with a confirmation step in Bulgarian.
- Write a privacy page in Bulgarian that covers what we store, why, how long, the 24-hour photo rule and how to delete the account (Q23). Link it from sign-up and settings.
- Run a retention check: confirm nothing is kept longer than the decisions allow (Q21).

**Done when**
- A member reports a user and a photo from the phone, and an admin sees both in the review list.
- A non-admin can't read other people's reports through the API.
- After "delete my account":
  - the user can't sign in
  - friends no longer see them, their plans, their RSVPs or their check-ins
  - their photo objects are gone from Storage
  - no row in any table references their id (checked with SQL)
- The privacy page opens in Bulgarian from the sign-up screen and from settings.

### Phase 8 — Closed beta (first 20 AUBG users) · S
**Goal:** a safe first launch with real people.

**Checklist**
- [ ] All launch venues are entered and **field-tested at each venue**:
  - a check-in succeeds inside and fails across the street
  - the radius is tuned for each venue
  - the window matches the venue's real opening nights (Q14)
- [ ] Events for the first weeks are entered.
- [ ] Simeon and Givo are admins. Nobody else is.
- [ ] RLS tests pass in CI. A manual pass with two phones on the "friends only", "hidden plan", "tag after accept" and "24-hour photo" rules is done.
- [ ] The Supabase plan is decided (Q2) and backups are confirmed.
- [ ] The privacy page is live and delete-account has been tested on a real account.
- [ ] Tested on at least one iPhone (Safari and installed PWA) and one Android phone (Chrome and installed PWA).
- [ ] A short Bulgarian guide covers opening the link, adding to the home screen, and allowing camera and location.
- [ ] A feedback channel for beta users is chosen (Q24).
- [ ] How beta users get access is decided (Q25).
- [ ] Clubs know that streak rewards are arranged offline and the app only shows the streak.
- [ ] We know how we'll notice errors in production (Q26).

---

## c) Work split

The work is split by feature. Each person owns a feature end to end: migration, policies, Edge Function, UI and tests. To avoid editing the same files:
- Each phase adds **its own new migration files**. Nobody edits a migration that is already merged; a later change goes in a new migration.
- Each feature lives in its own folder, for example `src/features/plans/` and `supabase/functions/verify-checkin/`.
- The only shared file that everyone appends to is `src/i18n/bg.ts`. Keep one section per feature in it to keep merge conflicts small and easy to resolve.
- The helper functions are owned by the phase that creates them. A later phase that needs a change asks the owner, or does it in a new migration.

| Phase | Owner | Can run in parallel with | Depends on |
|---|---|---|---|
| 0 Setup — app, CI, hosting | Simeon | 0 Supabase half (different folders) | — |
| 0 Setup — Supabase project, CLI, migrations, types | Givo | 0 app half | — |
| 1 Auth and profile | Simeon | — (everything after depends on it) | 0 |
| 2 Friends | Simeon | **3** | 1 |
| 3 Venues and events | Givo | **2** | 1 |
| 4 Plans | Simeon | **5** | 2, 3 |
| 5 Check-in | Givo | **4** | 2, 3 |
| 6 Streaks and stats | Givo | **7** | 5 |
| 7 Safety and GDPR | Simeon | **6** | 5 (photo reports), and needs every table to exist for delete-account |
| 8 Closed beta | Both | — | all |

**Why this split:**
- **2 ∥ 3:** friends and venues touch different tables and screens.
- **4 ∥ 5:** plans and check-ins both read `venues` and `are_friends()` but write different tables. Neither needs the other.
- **6 ∥ 7:** stats only read `checkins`. Delete-account only needs the foreign keys to cascade correctly, which belongs to the earlier phases.
- Each person gets one of the two L phases.

The names in the table are a suggestion. Swap them if you like, but keep the parallel pairs.

---

## d) Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | **GPS is inaccurate indoors.** Clubs are often in basements or between buildings, and a phone can report 50–500 m of error, so real guests get rejected. | Keep the most accurate fix from about 10 seconds of readings. Tune the radius per venue. Field-test every venue before the beta. Show a Bulgarian hint ("go to the entrance and try again") when accuracy is poor. The accuracy rule itself is Q13. |
| R2 | **iOS limits for PWAs and the camera.** An installed iOS PWA may ask for camera and location permission again on every launch. Safari's behaviour differs from Chrome. Push notifications only work for installed PWAs on recent iOS versions. | Test this in the Phase 0 spike on real iPhones before building on it. If the installed PWA is worse, recommend Safari as a normal tab. Don't plan v1 around push notifications (see Q7). |
| R3 | **The Supabase free tier pauses** the project after a period of inactivity and has storage and egress limits, which check-in photos use up. | Decide on the paid plan before the beta (Q2). Compress photos on the device. Check the current free-tier limits when deciding, because they change. |
| R4 | **Fake check-ins.** GPS can be spoofed in browser dev tools, and the API can be scripted with any image, so "in-app camera only" can only be enforced in the UI, not proven by the server. | All verification is server-side, using server time. Allow one check-in per venue per night (Q15). Rate-limit `verify-checkin`. Rely on reports and admin review. Field-tested venue radii help too. Accept that a determined user can cheat, and keep streak rewards modest for that reason. |
| R5 | **Under-18 users lie about their age.** The birth-date check is self-declared. | The database rejects under-18 birth dates, the terms state 18+, the report flow catches some cases, and admins act on reports. Whether we need stronger checks is Q6 and Q23. |
| R6 | **An RLS mistake leaks friends-only data.** This is the biggest privacy risk. | Use the helper functions everywhere instead of repeating logic. Add automated RLS tests for every rule in section a (Q27). Two-phone manual checks before each phase's PR. No service-role key in the frontend. Review every policy change in PRs. |
| R7 | **GDPR: photos and location.** Photos may show bystanders in the club. Location is sensitive. | Raw coordinates aren't stored. Photos are private by default and visible to friends for only 24 hours. Users can report photos and delete their account fully. Bystander rules are Q23. |
| R8 | **Time-zone and summer-time bugs** in nights and streaks. | Keep all night and week logic in one SQL helper. Use `timestamptz` everywhere. Add SQL tests for the summer-time nights (Phase 6). |
| R9 | **Migration conflicts between two developers.** | Only new migration files, owned per phase. Rebase on `main` before merging. CI runs migrations from scratch on every PR. |
| R10 | **Too few friends on the app at launch.** The app is only useful if your friends are on it. | Invite whole friend groups into the beta together, not 20 unrelated people (Q25). |

---

## e) Open questions

CLAUDE.md doesn't decide any of these. They're listed for Simeon and Givo to answer, and no answers are assumed here. Once something is decided, record it in CLAUDE.md.

**Infrastructure**

1. Which static host serves the frontend? Phase 0's deploy needs it.
2. Do we stay on the Supabase free tier for the beta, or pay for a plan? What is the monthly budget?

**Accounts**

3. What are the username rules: length, allowed characters, and can it be changed later?
4. Can a user correct their date of birth after sign-up? If so, how?
5. Email login: magic link, password, or both? Is email verification required?
6. When someone is rejected as under 18, do we keep anything (for example a hashed email to stop a retry with a fake birth date), or delete everything? Do we need any age check beyond the self-declared date?
7. Are there any notifications in v1 (friend request, tag, a friend's new plan)? If so: in-app only, email, or web push?

**Plans**

8. Must a plan's place be a listed venue, or can it be any place (free text or a map pin)?
9. In a friend's plan, do I see the RSVPs and accepted tags of people who are **not** my friends? Or only a count?
10. Who can tag friends in a plan: only the creator, or anyone who is Going?
11. Can the creator edit or cancel a plan after people have RSVP'd? What do those people see?

**Friends and blocking**

12. Should a blocked user be able to tell they're blocked? What happens to existing shared plans, tags and RSVPs when one person blocks the other? After a declined request, can the same person send a new request straight away?

**Check-in**

13. When the phone's GPS accuracy is worse than the venue radius, do we reject, accept if `distance − accuracy ≤ radius`, or use a fixed accuracy limit?
14. Is the check-in window the same every night for a venue, or different per weekday or only on opening nights?
15. Is more than one check-in at the same venue on the same night allowed?

**Streaks and stats**

16. Do we confirm the "night" rule? A check-in counts for the night on which the venue's window started.
17. Do we confirm the week rule? Weeks run Monday to Sunday in Sofia time, the current streak stays alive through the current week, and streaks are part of the stats.
18. How is "friends you go out with most" counted: verified check-ins at the same venue on the same night, Going on the same plans, or both?
19. Are stats visible to friends or hidden by default? Does the streak follow the same visibility setting?

**Safety, GDPR and legal**

20. What reasons can a report have? What can an admin do with one: remove a photo, invalidate a check-in, suspend a user? Does the reporter get told the outcome?
21. How long do we keep past plans, check-ins, photos (the owner can see them on their profile; for how long?) and reports?
22. Which map provider is used for the venue map (OpenStreetMap, Google Maps, or just a link to the phone's maps app)?
23. Who is named as the data controller on the privacy page, with what contact details and legal basis? Does someone with legal knowledge review it? Do we need terms of use? Is there a rule about other people visible in check-in photos?

**Beta and process**

24. Which feedback channel do beta users get?
25. How do the first 20 users get in: invite-only (and how is that enforced), or open sign-up with the link shared privately?
26. How will we notice errors in production (error tracking tool, Supabase logs only)?
27. How do we test RLS policies automatically: pgTAP via `supabase test db` in CI, Vitest against a local Supabase, or both?
28. CLAUDE.md says branches are named `feature/<name>`. Are other prefixes such as `docs/` allowed for non-feature work?
