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
  - Auth (Google + email)
  - Storage for check-in photos
  - Realtime for the live "who's coming" list
- **Security:**
  - Row Level Security is on for **every** table.
  - "Friends only" and "hidden from specific friends" are enforced **in the database**, never only in the UI.
  - 18+ is enforced in the database too, with a date-of-birth check, not only in the form.
- **Check-in verification** runs server-side in a Supabase Edge Function: GPS distance to the venue, the time window, and a photo taken in-app. Never trust the client's verdict.
- **Hosting:** the frontend is static files (host not chosen yet). The backend is Supabase.
- **Tooling:**
  - ESLint + Prettier
  - Vitest for unit tests
  - GitHub Actions runs typecheck, lint and tests on every PR

## Working rules

- Never commit to `main`. Use one branch per feature (`feature/<name>`), and the other person merges the PR.
- Every PR must pass CI before it is merged.
- Start every session with `git switch main && git pull`.
- Never commit secrets. Use `.env` (gitignored) and `.env.example` with empty values.
- Location data and photos are personal data (GDPR). Store only what a feature needs, and delete what's expired.
