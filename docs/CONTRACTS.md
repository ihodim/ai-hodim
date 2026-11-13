# Contracts (frozen)

This file is the exact interface the frozen spec tests are written against: names, signatures, error codes and file paths. The implementation must match it **exactly**. Anything not listed here (internal helpers, UI components, styling) is free.

**This file is protected.** Claude Code can't edit it. To change it, write a `spec-change` PR that both of you approve, and update the affected tests in the same PR.

Decisions referenced as `Qn` are in [DECISIONS.md](DECISIONS.md). The table design is in [BUILD_PLAN.md](BUILD_PLAN.md) section a. Where the two differ, this file wins.

## General rules

- Everything is in the `public` schema. **RLS is enabled on every table.**
- Extra columns are allowed only if they're nullable or have a default. The tests insert rows using only the columns listed here.
- Every `id uuid` primary key has `default gen_random_uuid()`. The tests sometimes insert explicit ids.
- RPC functions report a refused action with `raise exception` (SQLSTATE `P0001`) unless this file says otherwise.
- "Blocked" in a test means the action must not take effect. Whether it errors or silently affects 0 rows is up to you, unless this file names an error code.

## Phase 1: accounts

### Tables
`profiles(id uuid pk → auth.users on delete cascade, username citext not null unique, is_admin boolean not null default false, stats_visibility stats_visibility not null default 'friends', created_at timestamptz not null default now())`

- `stats_visibility` is an enum: `'friends' | 'hidden'`.
- `username` has a CHECK constraint (SQLSTATE `23514` on violation) matching `^[A-Za-z][A-Za-z0-9_.]{2,19}$` (Q3).

`profile_private(user_id uuid pk → profiles on delete cascade, date_of_birth date not null)`

- CHECK `date_of_birth <= current_date - interval '18 years'` (SQLSTATE `23514`).

### Helper functions
`is_member() returns boolean` and `is_admin() returns boolean`. Both use `auth.uid()`.

### Access rules (tested)
| Who | `profiles` | `profile_private` |
|---|---|---|
| owner | read; update `username` and `stats_visibility` only | read only |
| friend (accepted) | read | — |
| pending request (either direction) | read | — |
| user with an **accepted tag** on a plan the viewer can see (Q9) | read | — |
| anyone else, signed-in non-members, anon | nothing | nothing |

No client can insert into either table, change `is_admin`, or change `date_of_birth`.

### Edge Function `complete-signup`
`POST /functions/v1/complete-signup` with the user's JWT and a JSON body `{ "username": string, "date_of_birth": "YYYY-MM-DD" }`.

| Status | Body |
|---|---|
| 200 | `{ "ok": true }`: both rows are created |
| 400 | `{ "ok": false, "code": "invalid_username" }` or `"invalid_date"` |
| 401 | no or invalid JWT (body not checked) |
| 403 | `{ "ok": false, "code": "under_18" }`: the auth user is deleted (Q6) |
| 409 | `{ "ok": false, "code": "username_taken" }` or `"already_completed"` |

Age is checked against today's date in **UTC** (Q6).

### Frontend modules
- `src/lib/age.ts` exports `isAtLeast18(dob: string, today: string): boolean`. Both arguments are `YYYY-MM-DD`. It must give the same answer as the DB constraint, including Feb 29 birthdays. It returns `false` for invalid input.
- `src/lib/username.ts` exports `isValidUsername(s: string): boolean`, using the same regex as the DB.
- `src/lib/error-codes.ts` exports `SIGNUP_ERROR_CODES` (readonly array): exactly `invalid_username`, `invalid_date`, `under_18`, `username_taken`, `already_completed`.
- `src/i18n/bg.ts` exports `bg`. `bg.errors[code]` is a non-empty Bulgarian (Cyrillic) message for every signup and check-in error code.

## Phase 2: friends

`friendships(requester_id uuid → profiles on delete cascade, addressee_id uuid → profiles on delete cascade, status friendship_status not null, created_at, updated_at)`

- `friendship_status` is an enum: `'pending' | 'accepted' | 'blocked'`.
- There's a unique index on `(least(requester_id, addressee_id), greatest(requester_id, addressee_id))`, and a CHECK `requester_id <> addressee_id`.
- For `blocked`, `requester_id` is the blocker.
- Clients can't insert, update or delete rows directly. All writes go through the RPCs.
- Read: both users see `pending` and `accepted` rows. Only the blocker sees a `blocked` row.

### Functions
| Signature | Notes |
|---|---|
| `are_friends(a uuid, b uuid) returns boolean` | Symmetric. True only for `accepted`. |
| `find_user_by_username(p_username text) returns table(id uuid, username citext)` | Exact match, case-insensitive. Never returns the caller's blocked pairs in either direction. |
| `send_friend_request(p_addressee uuid) returns void` | Fails (`P0001`) if any row exists for the pair, if the target is the caller, or if the caller isn't a member. |
| `accept_request(p_requester uuid) returns void` | Caller must be the addressee of a `pending` row from `p_requester`, else `P0001`. |
| `decline_request(p_requester uuid) returns void` | Deletes that pending row. |
| `unfriend(p_friend uuid) returns void` | Deletes the accepted row. |
| `block_user(p_target uuid) returns void` | Replaces any row with `caller → target, blocked`. |
| `unblock_user(p_target uuid) returns void` | Only the blocker. Deletes the row. |

## Phase 3: venues and events

`venues(id uuid pk, name text not null, address text not null, lat double precision not null, lng double precision not null, phone text not null, checkin_radius_m integer not null default 100 check (> 0), checkin_window_start time not null default '22:00', checkin_window_end time not null default '04:00', created_by uuid → profiles on delete set null, created_at timestamptz default now())`

`events(id uuid pk, venue_id uuid not null → venues on delete cascade, performer text not null, starts_at timestamptz not null, promo text, created_by uuid → profiles on delete set null, created_at timestamptz default now())`

- Read: members only.
- Write: `is_admin()` only.

## Phase 4: plans

- `plans(id uuid pk, creator_id uuid not null → profiles on delete cascade, venue_id uuid not null → venues on delete restrict, event_id uuid → events on delete set null, starts_at timestamptz not null, created_at timestamptz default now())`
  - A trigger rejects an `event_id` from a different venue.
- `plan_rsvps(plan_id → plans cascade, user_id → profiles cascade, status rsvp_status not null, updated_at timestamptz default now(), primary key (plan_id, user_id))`
  - `rsvp_status` is an enum: `'going' | 'maybe' | 'out'`.
- `plan_tags(plan_id → plans cascade, tagged_user_id → profiles cascade, tagged_by → profiles cascade, status tag_status not null default 'pending', created_at default now(), primary key (plan_id, tagged_user_id))`
  - `tag_status` is an enum: `'pending' | 'accepted'`.
- `plan_hidden_from(plan_id → plans cascade, user_id → profiles cascade, primary key (plan_id, user_id))`

### Functions
| Signature | Notes |
|---|---|
| `can_see_plan(p_plan_id uuid) returns boolean` | True if the caller is the creator, or is a friend of the creator and not hidden. |
| `plan_rsvp_counts(p_plan_id uuid) returns table(going_count int, maybe_count int, out_count int)` | Counts **all** RSVPs. Returns **no row** if the caller can't see the plan. |

### Rules (tested)
- **Plans:** members insert with `creator_id = auth.uid()`. Only the creator can update or delete. Read requires `can_see_plan`.
- **RSVPs:** you write only your own row, on a plan you can see. You can read your own RSVP, the creator's, and your friends' (Q9).
- **Tags:**
  - Only the creator inserts, with `tagged_by = auth.uid()` and `status = 'pending'`.
  - The tagged person must be the creator's friend and not hidden from the plan.
  - Only the tagged person can set `accepted`. The tagged person or the tagger can delete.
  - The tagger and the tagged person always see the row. Others who can see the plan see it only once it's `accepted`.
- **Hidden-from list:** only the creator reads or writes it.
- **Realtime:** `plan_rsvps` and `plan_tags` are in the `supabase_realtime` publication.

## Phase 5: check-ins

`checkins(id uuid pk, user_id uuid not null → profiles on delete cascade, venue_id uuid not null → venues on delete restrict, created_at timestamptz not null default now(), night_date date not null, distance_m integer not null, accuracy_m integer not null, photo_path text not null, unique (user_id, venue_id, night_date))`

- Clients can't insert, update or delete rows.
- Read: the owner, the owner's friends, and admins.
- Admins can delete (Q20).

### Function
`checkin_night(p_venue_id uuid, p_ts timestamptz) returns date`

- Converts `p_ts` to `Europe/Sofia` local time.
- Returns `null` if the local time is outside `[checkin_window_start, checkin_window_end)`.
- Otherwise returns the Sofia date on which the window **started**. For a window that crosses midnight, a time before the end belongs to the previous date.

### Storage
- A **private** bucket with id `checkin-photos`.
- Object path: `{user_id}/{checkin_id}.jpg`.
- Read: the owner always. A friend only while the check-in's `created_at > now() - interval '24 hours'`.
- No client uploads.

### Edge Function `verify-checkin`
`POST /functions/v1/verify-checkin`, `multipart/form-data`, with these fields:

- `venue_id`
- `lat`, `lng` (decimal degrees)
- `accuracy_m` (number)
- `photo` (JPEG file)

The checks run in this **order**. The first failure returns its code:

| # | Check | Status | `code` |
|---|---|---|---|
| — | No or invalid JWT | 401 | — |
| 1 | Caller has a profile | 403 | `not_member` |
| 2 | Venue exists | 404 | `venue_not_found` |
| 3 | Server time is inside the window (`checkin_night` is not null) | 422 | `outside_window` |
| 4 | `accuracy_m` ≤ 100 (Q13) | 422 | `low_accuracy` |
| 5 | Haversine distance ≤ `checkin_radius_m` | 422 | `too_far` |
| 6 | No check-in at this venue for this `night_date` yet | 409 | `already_checked_in` |
| 7 | `photo` decodes as a JPEG and is ≤ 2 MB | 400 | `bad_image` |
| — | Rate limit (allow at least 10 requests per user per minute) | 429 | `rate_limited` |

On success it returns `200 { "ok": true, "checkin_id": uuid, "night_date": "YYYY-MM-DD" }`, after uploading the photo and inserting the row.

### Shared module
`supabase/functions/_shared/checkin-rules.ts` is pure TypeScript with no Deno or Node APIs. It is imported by the Edge Function and by the unit tests. It exports:

- `MAX_ACCURACY_M = 100`
- `haversineMeters(a: {lat:number,lng:number}, b: {lat:number,lng:number}): number`, using an Earth radius of 6 371 008.8 m
- `evaluateLocation(i: {distanceM:number, accuracyM:number, radiusM:number}): 'ok' | 'low_accuracy' | 'too_far'`
  - `low_accuracy` if `accuracyM > MAX_ACCURACY_M`
  - else `too_far` if `distanceM > radiusM`
  - else `ok`
- `pickBestFix(fixes: {lat:number,lng:number,accuracyM:number}[]): fix | null`, returning the smallest `accuracyM`, the first one on ties, or `null` if the list is empty

### Error codes
`src/lib/error-codes.ts` exports `CHECKIN_ERROR_CODES`: exactly `not_member`, `venue_not_found`, `outside_window`, `low_accuracy`, `too_far`, `already_checked_in`, `bad_image`, `rate_limited`.

## Phase 6: streaks and stats

| Signature | Returns |
|---|---|
| `venue_streaks(p_user_id uuid, p_as_of timestamptz default now()) returns table(venue_id uuid, weeks int)` | One row per venue where the user has at least one check-in. `weeks` follows the BUILD_PLAN Phase 6 rules, with weeks from `night_date` in Sofia ISO weeks. It may be 0. |
| `user_stats(p_user_id uuid) returns jsonb` | `{ "nights_out": int, "top_venues": [{"venue_id": uuid, "nights": int}], "top_friends": [{"user_id": uuid, "nights": int}] }`. Both lists are sorted by `nights` descending. |

Access for both functions: the owner always. A friend only when the owner's `stats_visibility = 'friends'`. Anyone else gets **no rows** from `venue_streaks` and **`null`** from `user_stats`. `top_friends` counts shared nights (same venue, same `night_date`) with **current friends** only (Q18).

## Phase 7: reports and account deletion

`reports(id uuid pk, reporter_id uuid → profiles on delete set null, target_user_id uuid → profiles on delete cascade, target_checkin_id uuid → checkins on delete cascade, reason report_reason not null, status report_status not null default 'open', created_at timestamptz default now(), reviewed_at timestamptz, reviewed_by uuid → profiles on delete set null)`

- CHECK: exactly one target is set (SQLSTATE `23514`).
- `report_reason` is an enum: `'inappropriate' | 'harassment' | 'underage' | 'fake_checkin' | 'other'`.
- `report_status` is an enum: `'open' | 'reviewed'`.
- Insert: a member with `reporter_id = auth.uid()`, who can see the target.
  - A user target must be readable in `profiles`.
  - A check-in target must be readable in `checkins`.
- Read: the reporter's own reports. Admins read all.
- Update: admins only.

### Edge Function `delete-account`
`POST /functions/v1/delete-account` with the user's JWT and no body.

- Deletes every object under `checkin-photos/{user_id}/`, then deletes the auth user.
- Returns `200 { "ok": true }`, or `401` without a valid JWT.
