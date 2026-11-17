# iHodim — project rules

Two developers (Simeon and Givo) work on this repo, each with Claude Code. This file is the shared source of truth. If a request conflicts with a decision below, stop and ask instead of quietly changing the decision. Change this file only in a PR that both of you approve.

## What the product is

A social web app for planning nights out with friends. The core loop:
**friends → make a plan (place + date + time) → tag friends → Going / Maybe / Out → live list of who's coming → check in at the club → streaks.**

The goal is connecting people, not advertising events. Events exist to make planning easier.

Launch: **Blagoevgrad**, AUBG students, 5–6 clubs. UI language: **Bulgarian** (keep all strings in one place so English can be added later).

## Decided (v1)

**Accounts**
- **18+ only.** Date of birth is required at sign-up, and anyone under 18 is rejected. No exceptions.
- Login: **Google or email**. No Instagram login (Meta's consumer login API is gone).
- Public identity is a **username**. Real names aren't required.

**Friends & privacy**
- **Mutual friendships** (Facebook-style): request, then accept. No one-way follows.
- Plans, check-ins and stats are visible to **friends only**, never to strangers.
- A user can **hide a plan from specific friends**.
- Block and report are available for users and photos.

**Plans**
- Anyone can create a plan: place + date + time. It can link to a listed event, but it doesn't have to.
- RSVP: **Going / Maybe / Out**, one tap.
- You can tag friends in a plan, but a tag shows only **after the tagged person accepts**.
- **No in-app chat** in v1.

**Venues & events**
- In v1, venues and events are entered by **admins only** (Simeon and Givo). No club logins yet.
- Venue page: name, address, map location, **phone number with a call button**, events (performer, date, promos).
- **No in-app booking and no discounts** in v1. Just the phone number.

**Check-in (verified)**
- **In-app camera only**, no gallery uploads.
- **GPS**: the user must be within about 100 m of the venue (set per venue).
- **Time window**: for example 22:00–04:00 on the night (set per venue).
- No verified check-in means no streak.
- Check-in photos disappear for others after **24 hours**, but the owner can still see them on their profile.
- No QR codes in v1 (maybe later, once the app is popular).

**Streaks & stats**
- A streak is counted **per venue**: consecutive weeks with at least one verified check-in at that venue.
- Clubs may reward streaks (e.g. 4 weeks in a row). That's arranged offline in v1, and the app only shows the streak.
- Stats: nights out, top venues, the friends you go out with most. The user chooses whether they're **visible to friends or hidden**.

## Not in v1

Chat, club accounts and dashboard, bookings, discounts, QR check-in, finding strangers, public profiles, native mobile apps. Don't build these unless this file is updated first.

## Stack

**Decided (v1).** The phased plan is in [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).

- **Language:** TypeScript everywhere, in strict mode.
- **Frontend:** React + Vite, as a mobile-first PWA. It must work well in a phone browser, with camera and GPS through the browser. All Bulgarian UI strings live in one i18n file.
- **Backend:** Supabase in the EU (Frankfurt) region:
  - Postgres for data
  - Auth (Google + email magic link, no passwords; see DECISIONS Q5)
  - Storage for check-in photos
  - Realtime for the live "who's coming" list
- **Security:**
  - Row Level Security is on for **every** table.
  - "Friends only" and "hidden from specific friends" are enforced **in the database**, never only in the UI.
  - 18+ is enforced in the database too, with a date-of-birth check, not only in the form.
- **Check-in verification** runs server-side in a Supabase Edge Function: GPS distance to the venue, the time window, and a photo taken in-app. Never trust the client's verdict.
- **Hosting:** the frontend is static files on **Cloudflare Workers** (static assets, `wrangler.jsonc`; see DECISIONS Q1). The backend is Supabase.
- **Tooling:**
  - ESLint + Prettier
  - Vitest for unit and integration tests, pgTAP (`supabase test db`) for database tests
  - GitHub Actions runs typecheck, lint and the spec on every PR
  - Node 22 (the spec runner needs Node 20.11 or newer)

## Frozen spec (tests are written before the code)

The tests below were written **before** any implementation. They define "done". You build code to pass them, and never change them to match the code.

- **Spec files:**
  - `supabase/tests/database/*.sql` (pgTAP)
  - `tests/unit/*`
  - `tests/integration/*`
  - `tests/fixtures/*`
  - `scripts/run-spec.mjs`
  - `docs/CONTRACTS.md`
  - `CURRENT_PHASE`
  - `.claude/hooks/*` and `.claude/settings.json`
  - `.github/workflows/spec-guard.yml`
- **Never** edit, rename, delete or skip them:
  - no `.skip`, `.only` or `todo`
  - no config that excludes them
  - no bumping `CURRENT_PHASE`

  A hook blocks these edits. CI fails any PR that touches them without the `spec-change` label.
- **Contracts:** implement names, signatures, error codes and paths **exactly** as in [docs/CONTRACTS.md](docs/CONTRACTS.md). Answers to the BUILD_PLAN open questions are in [docs/DECISIONS.md](docs/DECISIONS.md).
- **Done for phase N** means all of these, with `CURRENT_PHASE` = N:
  - `npm run test:spec` passes
  - `npm run test:spec -- --integration` passes when the phase has integration specs
  - typecheck and lint pass
  - the developer has finished the manual phone checks from BUILD_PLAN "Done when"
- **If you think a spec test or contract is wrong, stop and explain** which assertion and why. Don't work around it.
- **Extra tests of your own are welcome** next to the code (`src/**/*.test.ts`), but never under `tests/` or `supabase/tests/`. They don't replace the spec.
- **Every phase's prompt is in [docs/PHASE_PROMPTS.md](docs/PHASE_PROMPTS.md).**

## Codebase map (graphify)

If `graphify-out/GRAPH_REPORT.md` exists, read it before searching the codebase broadly, and use the graph instead of reading every file. It's generated locally and gitignored. At the end of each phase, remind the developer to rebuild it with `/graphify .`.

## Working rules

- Never commit to `main`. Branch prefixes are `feature/`, `fix/`, `docs/`, `test/` and `chore/`. The other person merges the PR.
- Every PR must pass CI before it is merged.
- Start every session with `git switch main && git pull`.
- Never commit secrets. Use `.env` (gitignored) and `.env.example` with empty values.
- Location data and photos are personal data (GDPR). Store only what a feature needs, and delete what's expired.
