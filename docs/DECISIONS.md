# Decisions for the BUILD_PLAN open questions

[BUILD_PLAN.md](BUILD_PLAN.md) ends with 28 open questions. The frozen spec tests (see [CONTRACTS.md](CONTRACTS.md)) can't be written without answers to some of them. Each one gets one of these statuses:

- **Default**: chosen so the tests could be written. **The tests encode it.** To change it, update this file, CONTRACTS.md and the affected tests in a `spec-change` PR that both of you approve.
- **Open**: not decided yet, and no test depends on it. It must be answered before the phase listed.
- **Decided**: settled by both of you, and no test depends on it. Change it with a normal PR that both of you approve.

| Q | Topic | Status | Answer | Tests |
|---|---|---|---|---|
| 1 | Static host | **Decided** (Phase 0) | **Cloudflare Pages**, connected to the GitHub repo: production branch `main`, a preview deployment for every branch, build `npm run build`, output `dist`, Node 22 from `.nvmrc`. The only env vars are `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `public/_redirects` serves `index.html` for every path, so deep links don't 404. **Why not Vercel:** Vercel Hobby can't deploy private GitHub org repos, and the Hobby plan is for non-commercial use only. | — |
| 2 | Supabase plan and budget | **Open** (before Phase 8) | Free tier while building. | — |
| 3 | Username rules | Default | 3–20 characters. Must start with a Latin letter. Only `A–Z a–z 0–9 _ .` are allowed. Matching is case-insensitive (`Ivan` = `ivan`). The owner can change it later. | 010, phase1-username |
| 4 | Correcting date of birth | Default | Clients can't change it. An admin fixes it by hand with SQL if a user asks. | 010 |
| 5 | Email login method | Default | Google + **magic link**, with no passwords in the UI. Local tests may use password sign-in through the admin API. | — |
| 6 | Under-18 rejection | Default | Delete the auth user and keep nothing. No extra age check beyond the self-declared date in v1. Age is compared against **today's date in UTC**, the same as the DB constraint. | 010, phase1 integration |
| 7 | Notifications in v1 | **Open** (before Phase 4 UI) | Suggested: none in v1, only the in-app plan feed. | — |
| 8 | Plan place | Default | A plan's place must be a **listed venue**. | 040 |
| 9 | Seeing non-friends in a friend's plan | Default | You see RSVPs from yourself, the creator and your own friends, plus **total counts** through `plan_rsvp_counts`. People with an **accepted tag** on a plan you can see are visible by username, even if they aren't your friends. | 040 |
| 10 | Who can tag | Default | Only the plan creator. | 040 |
| 11 | Editing or cancelling a plan | Default | The creator can edit or delete it. Deleting it removes its RSVPs and tags. | 040 |
| 12 | Blocking details | Default | The blocked person can't tell they're blocked: no search hit, and a request fails with a generic error. Shared plans disappear automatically because the friendship is gone. A declined request can be re-sent straight away. | 020 |
| 13 | GPS accuracy rule | Default | Reject with `low_accuracy` if the reported accuracy is over **100 m**. Otherwise accept if the distance is ≤ the venue radius. Accuracy is checked before distance. | phase5-checkin-rules, phase5 integration |
| 14 | Check-in window | Default | The same window every night for a venue. Start is inclusive, end is exclusive. | 050 |
| 15 | Several check-ins per night | Default | One per venue per night (`unique (user_id, venue_id, night_date)`). | 050, phase5 integration |
| 16 | Night rule | Default | Confirmed as proposed in BUILD_PLAN Phase 6. | 050, 060 |
| 17 | Week rule | Default | Confirmed as proposed: ISO weeks in Sofia time, computed from `night_date`, and the current week keeps the streak alive. | 060 |
| 18 | "Friends you go out with most" | Default | Count the nights where both people have a verified check-in at the **same venue on the same night**. Only people who are currently friends are counted. | 060 |
| 19 | Stats default visibility | Default | `friends`. Streaks follow the same setting. The owner always sees their own. | 010, 060 |
| 20 | Reports | Default | Reasons are `inappropriate`, `harassment`, `underage`, `fake_checkin` and `other`. An admin can mark a report reviewed and can delete a check-in, which removes its photo. The reporter isn't told the outcome in v1. | 070 |
| 21 | Retention | **Open** (before Phase 7) | Suggested: check-ins and photos are kept until the account is deleted. Reports are kept 12 months. | — |
| 22 | Map provider | Default | No embedded map. A button opens the phone's maps app at the venue's coordinates. | — |
| 23 | Privacy page and legal | **Open** (before Phase 7) | Needs a named data controller and contact. Get it reviewed by someone with legal knowledge before the beta. | — |
| 24 | Beta feedback channel | **Open** (before Phase 8) | — | — |
| 25 | Beta access | Default | Open sign-up, with the link shared privately with whole friend groups. | — |
| 26 | Production error tracking | **Open** (before Phase 8) | — | — |
| 27 | How RLS is tested | Default | Both: pgTAP via `supabase test db` and Vitest integration tests against local Supabase. | all |
| 28 | Branch prefixes | Default | `feature/`, `fix/`, `docs/`, `test/` and `chore/` are all allowed. | — |
