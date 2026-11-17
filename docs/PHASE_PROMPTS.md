# Phase prompts

There's one prompt for each BUILD_PLAN phase, ready to paste into Claude Code. The shared rules (frozen spec, contracts, definition of done) are in `CLAUDE.md`, which Claude Code loads by itself. So each prompt only says what's specific to its phase.

## 0. One-time setup (both of you, on your own laptops)

**Skills you already have.** These are in your claude.ai account. They are **not** automatically in Claude Code on your laptop, so install them there:

| Skill | Used for | Install in Claude Code |
|---|---|---|
| `engineering` plugin: `code-review`, `debug`, `deploy-checklist`, `documentation`, `testing-strategy` | Reviewing every phase before the PR, debugging failing specs, Phase 8 launch checklist | `/plugin marketplace add anthropics/knowledge-work-plugins`, then `/plugin install engineering@knowledge-work-plugins` |
| `frontend-design` | Every screen (onboarding, friends, venue page, plan page, camera, stats) | `/plugin install frontend-design@claude-plugins-official` |
| `graphify` | Codebase map, so Claude Code doesn't reread every file | Already installed. Rebuild with `/graphify .` **after each phase is merged**. Today the repo is almost empty, so the graph you already built is close to useless. |
| `hostinger:*` deploy skills | Phase 0 deploy, **only if** your paid hosting is Hostinger | Already in your account. Use `hostinger:hosting-deploy-static-site`. |
| `dataviz` | Optional, for the stats screen in Phase 6 | Already in your account |

**Skills to download:**

| Skill | Why | Install |
|---|---|---|
| **Supabase Agent Skills** (`supabase` + `supabase-postgres-best-practices`) | Teaches Claude Code current Supabase patterns: RLS, Edge Functions, Storage, Realtime. Most of this project is Supabase. | Run in the repo folder: `npx skills add supabase/agent-skills`. It installs at project scope, so **commit the result** and Givo gets it too. |

**Skipped on purpose:** `obra/superpowers` (and its TDD skill). The frozen spec already gives you test-first development. Superpowers' own workflow (writing its own tests, worktrees, subagents) would compete with these prompts.

**About graphify:** if you ran `graphify claude install`, it added a hook to `.claude/settings.json`, which is now a protected file. Merge its hook entry into the `PreToolUse` list **by hand** (both hooks can sit in the same list), in a `spec-change` PR.

**GitHub, once, by the repo owner (Givo):**
1. Settings → Rules (or Branches) → protect `main`: require a pull request, 1 approval, and status checks `spec-guard` + `ci` (`ci` exists after Phase 0).
2. Create a label named `spec-change`.

## How to run every phase (human steps)

```
git switch main && git pull
git switch -c feature/phase-N-<short-name>
```

1. **Open `CURRENT_PHASE`, change the number to N, save, then:** `git commit -am "chore: start phase N"`. Do this yourself. Claude Code is blocked from changing it.
2. **Start Claude Code in the repo, switch to plan mode** (Shift+Tab until it says plan mode), and paste the phase prompt.
3. **Read the plan.** Check that every spec file for the phase is mapped to code. Approve it.
4. **When it says it's done, run `npm run test:spec` yourself** (plus `-- --integration` if the phase has integration specs). Trust that output, not its summary.
5. **Do the phone checks** from BUILD_PLAN "Done when".
6. **The PR gets reviewed by the other person.** Merge only when `ci` and `spec-guard` are green.
7. **After the merge, rebuild the graph:** `/graphify .`

**If Claude Code says a spec test is wrong:**
1. Don't let it work around the test.
2. Read the test and the contract.
3. If it really is wrong, fix it in a **separate** `spec-change` PR that both of you approve.
4. Then continue the phase.

---

## Phase 0: Project setup

**Before you paste:**
- Create the Supabase project in the **EU (Frankfurt)** region.
- Decide the static host (DECISIONS Q1), because the deploy step needs it.

```
We are starting Phase 0 (project setup) of iHodim. CURRENT_PHASE is 0.

Read first: CLAUDE.md, docs/BUILD_PLAN.md (Phase 0), docs/DECISIONS.md, docs/CONTRACTS.md, scripts/run-spec.mjs,
supabase/tests/database/000-setup.sql and 999-teardown.sql. Do not create any tables or features from later phases.

Skills: use `supabase` for the Supabase CLI setup, `frontend-design` for the app shell and first page,
and `engineering:code-review` on the final diff.

Plan first (plan mode), wait for my approval, then build:
1. Vite + React + TypeScript (strict). Node 22 (.nvmrc). ESLint + Prettier.
2. Vitest. vitest.config.ts must include `tests/**/*.test.ts` and `src/**/*.test.ts` and must NOT exclude anything under tests/.
   Dev dependencies must include vitest and @supabase/supabase-js (the integration specs import it).
3. package.json scripts: dev, build, preview, typecheck (tsc --noEmit), lint, format, test (vitest run src),
   "test:spec": "node scripts/run-spec.mjs".
4. src/i18n/bg.ts exporting `bg` with an `errors` object (empty for now) and the app title. The first page reads its title from it.
5. PWA manifest + icons (add to home screen), served over HTTPS in production.
6. `npx supabase init`. Local stack works with `npx supabase start`. supabase/migrations/ exists (empty).
   Generate TypeScript types into src/lib/database.types.ts with an npm script (types:gen).
7. .env.example with VITE_SUPABASE_URL= and VITE_SUPABASE_ANON_KEY= (empty). Service-role key never in the frontend.
8. .github/workflows/ci.yml on pull_request: checkout, setup-node from .nvmrc, npm ci, typecheck, lint,
   supabase/setup-cli@v1, `npx supabase start`, start `npx supabase functions serve` in the background ONLY if
   supabase/functions contains a function folder other than _shared (wait until it responds), then
   `npm run test:spec -- --integration`. Job name: `ci`.
9. A throwaway /spike page (dev only) that opens the rear camera with getUserMedia and reads GPS with watchPosition,
   showing accuracy. I will test it on an iPhone and an Android phone, in the browser and as an installed PWA.
10. **Deploy config for Cloudflare Workers with static assets** (replaces the old Vercel and Pages steps)
    - Hosting is Cloudflare Workers (static assets, deployed by Workers Builds), not Pages and not
      Vercel. Vercel Hobby can't deploy private GitHub org repos. Do NOT add vercel.json or any
      Vercel config, and no Pages `_redirects` file.
    - Check every Wrangler key and Workers Builds variable against Cloudflare's current docs, not memory.
    - Add `wrangler` as a pinned devDependency (Workers Builds uses the package.json version; Worker
      Previews needs >= 4.135.0).
    - Create `wrangler.jsonc`:
      - `name` exactly matching the Worker's name in the dashboard (`ai-hodim`), or builds fail
      - a `compatibility_date`
      - `assets.directory`: `./dist`
      - `assets.not_found_handling`: `"single-page-application"`
        (SPA fallback so deep links like /plans/123 serve index.html instead of 404)
      - `preview_urls: true` and an empty `previews` block (required by `wrangler preview`)
    - Build command: `npm run build`. Deploy command (production): `npx wrangler deploy`.
      Preview command (other branches): `npx wrangler preview`.
    - The /spike page is built only when `mode === 'development' || (WORKERS_CI === '1' &&
      WORKERS_CI_BRANCH !== 'main')`, i.e. in dev and Workers preview builds. A plain
      `npm run build` must contain no spike chunk.
    - Add `.nvmrc` pinning the same Node major version the project uses
      locally, so the Cloudflare build matches (Workers Builds defaults to Node 24 otherwise).
    - The only env vars the frontend may read are `VITE_SUPABASE_URL` and
      `VITE_SUPABASE_ANON_KEY`. Add both to `.env.example` with empty values.
      Never reference the Supabase service-role key anywhere in frontend code.
    - Do not connect or configure the Cloudflare Worker yourself. A human (org owner) connects
      ihodim/ai-hodim in Workers Builds with the settings above: production branch `main`,
      preview builds on, and the two VITE_ vars as **build** variables (Vite reads them at build
      time) for both production and Preview builds.
    - Done when: the PR's Workers Preview URL loads and shows the
      Bulgarian app title, and a hard refresh on a non-root route still loads
      the app.
    - Update `docs/DECISIONS.md` Q1: hosting = Cloudflare Workers with static assets, with the
      reasons (Cloudflare's recommended path for new projects; Vercel Hobby can't deploy private
      org repos, and its plan is non-commercial only).

**Phone check:** the spike page on both phones. Write the results (camera and GPS, browser vs installed PWA) into the PR description.

---

## Phase 1: Auth and profile

**Before you paste:**
- Set up the Google OAuth client and add it in the Supabase dashboard (Auth → Providers).
- Locally, magic-link emails show up in the local mail viewer that `supabase start` prints.

```
We are starting Phase 1 (auth and profile). CURRENT_PHASE is 1.

Read first: CLAUDE.md, docs/CONTRACTS.md "Phase 1", docs/DECISIONS.md (Q3, Q4, Q5, Q6, Q19), docs/BUILD_PLAN.md Phase 1.
The definition of done is these frozen spec files. Read every one of them fully before planning:
- supabase/tests/database/010-phase1-auth-profile.test.sql
- tests/unit/phase1-age.test.ts, phase1-username.test.ts, phase1-signup-messages.test.ts
- tests/integration/phase1-complete-signup.test.ts (+ tests/integration/_support/*)

Skills: `supabase` and `supabase-postgres-best-practices` for every migration, policy and the Edge Function;
`frontend-design` for the onboarding and sign-in screens; `engineering:code-review` before the PR.

Step 1 (plan mode): list the migration(s), helper functions, RLS policies, column grants, the complete-signup Edge
Function, the src/lib modules and the screens. For EVERY assertion in the spec files, say which piece of code makes it pass.
List anything in the spec you think is wrong or ambiguous. Wait for my approval.
Step 2 (red): run `npm run test:spec` and show that the phase 1 specs fail.
Step 3 (build):
 - Migration: profiles + profile_private exactly as in CONTRACTS (citext username with the CHECK regex, 18+ CHECK,
   is_admin, stats_visibility enum default 'friends'), RLS on both, is_member() and is_admin() as
   `security definer` + `set search_path = ''`. Owner may update only username and stats_visibility (column grants).
   No client inserts. Profile read rule for now: owner only (friends/pending/tag rules come in phases 2 and 4).
 - Edge Function complete-signup with the exact status codes and bodies from CONTRACTS. It uses the service role only
   inside the function. Age is checked against today's UTC date. Under 18: delete the auth user. Ignore unknown body
   fields (never let a client set is_admin).
 - src/lib/age.ts, src/lib/username.ts, src/lib/error-codes.ts (SIGNUP_ERROR_CODES), Bulgarian messages in src/i18n/bg.ts.
 - Auth: Google + email magic link (no password UI). Onboarding screen (username + date of birth, Bulgarian),
   route guard: signed in without profile -> onboarding only. Sign out.
Step 4 (green): with `npx supabase start` and `npx supabase functions serve` running, run
`npm run test:spec -- --integration` until it passes, plus typecheck and lint. Paste the summary lines.
Step 5 (review): run engineering:code-review on the diff against main, focusing on RLS holes, security definer
functions without search_path, and the service-role key. Fix and re-run the spec.
Step 6: give me the phone checklist from BUILD_PLAN Phase 1 "Done when", commit, push, open the PR
"Phase 1: auth and profile" with the spec summary in the description. Do not merge.
```

---

## Phase 2: Friends

```
We are starting Phase 2 (friends). CURRENT_PHASE is 2.

Read first: CLAUDE.md, docs/CONTRACTS.md "Phase 2", docs/DECISIONS.md (Q12), docs/BUILD_PLAN.md Phase 2.
Frozen spec for this phase (read fully before planning): supabase/tests/database/020-phase2-friends.test.sql.
Phase 1 specs must keep passing.

Skills: `supabase` + `supabase-postgres-best-practices` for the migration and RPCs, `frontend-design` for the
friends screens, `engineering:code-review` before the PR.

Step 1 (plan mode): migration, RPCs, policies, screens. Map every assertion in 020 to code. Wait for approval.
Step 2 (red): run `npm run test:spec`, show 020 failing and 010 still passing.
Step 3 (build):
 - friendships table, enum, pair-unique index, self-check, RLS read rule from CONTRACTS, no direct client writes.
 - are_friends, find_user_by_username and the six RPCs, all `security definer` + `set search_path = ''`.
   Watch out: inside a function with an empty search_path, `citext = citext` is NOT found and Postgres silently
   falls back to case-sensitive text comparison. Qualify the operator or compare lower() values.
 - Extend the profiles read policy: friends and pending-request pairs (either direction) can read the profile.
   A block must hide the profile again.
 - Friends screen: search by exact username, incoming/outgoing requests, accept, decline, unfriend, friend list;
   block from a profile; blocked list with unblock in settings. Bulgarian strings in bg.ts.
Step 4 (green): `npm run test:spec -- --integration`, typecheck, lint. Paste the summary.
Step 5 (review): engineering:code-review on the diff. Fix, re-run.
Step 6: phone checklist from BUILD_PLAN Phase 2 (two phones), commit, push, PR "Phase 2: friends". Do not merge.
```

---

## Phase 3: Venues and events

```
We are starting Phase 3 (venues and events). CURRENT_PHASE is 3.

Read first: CLAUDE.md, docs/CONTRACTS.md "Phase 3", docs/DECISIONS.md (Q22), docs/BUILD_PLAN.md Phase 3.
Frozen spec: supabase/tests/database/030-phase3-venues-events.test.sql. Earlier phases must keep passing.

Skills: `supabase` + `supabase-postgres-best-practices`, `frontend-design` for the venue page and admin forms,
`engineering:code-review` before the PR.

Step 1 (plan mode): migration, policies, screens; map every assertion in 030 to code. Wait for approval.
Step 2 (red): show 030 failing, earlier files passing.
Step 3 (build):
 - venues + events exactly as CONTRACTS (defaults: radius 100, window 22:00-04:00, radius CHECK > 0), RLS: members read,
   is_admin() writes.
 - Admin screens (visible only when is_admin): create/edit venue incl. lat/lng, radius, window; create/edit event.
 - Venue list and venue page: name, address, "open in maps" button (phone maps app at lat/lng, no embedded map),
   call button (tel:), upcoming events in date order (no past events).
 - A documented SQL snippet (not a client feature) to make Simeon and Givo admins: docs/ADMIN.md.
Step 4 (green), Step 5 (review), Step 6 (phone checklist BUILD_PLAN Phase 3, commit, push, PR "Phase 3: venues and events").
```

---

## Phase 4: Plans

```
We are starting Phase 4 (plans). CURRENT_PHASE is 4.

Read first: CLAUDE.md, docs/CONTRACTS.md "Phase 4", docs/DECISIONS.md (Q7, Q8, Q9, Q10, Q11), docs/BUILD_PLAN.md Phase 4.
Frozen spec: supabase/tests/database/040-phase4-plans.test.sql (52 assertions). Earlier phases must keep passing.

Skills: `supabase` (Realtime + RLS) + `supabase-postgres-best-practices`, `frontend-design` for the plan screens,
`engineering:code-review` before the PR. If a spec keeps failing, use `engineering:debug` instead of guessing.

Step 1 (plan mode): migration, helper functions, policies, trigger, Realtime, screens; map every assertion in 040 to
code. Pay special attention to: the hidden friend must not be able to detect the plan; tags visible to others only
once accepted; RSVPs of non-friends hidden but counted (plan_rsvp_counts); only the tagged person can accept.
Wait for approval.
Step 2 (red).
Step 3 (build):
 - plans, plan_rsvps, plan_tags, plan_hidden_from + enums exactly as CONTRACTS; can_see_plan and plan_rsvp_counts
   as `security definer` + `set search_path = ''`; event-venue trigger; Realtime publication for plan_rsvps and plan_tags.
 - Extend the profiles read policy: people with an ACCEPTED tag on a plan the viewer can see.
 - Create-plan screen (venue, date/time in Sofia time, optional event at that venue, tag friends, hide from friends),
   plans feed, plan page with one-tap Going/Maybe/Out, live "who's coming" list via Realtime (no refresh),
   counts for people you can't see, accept/decline tag, creator edit/delete.
 - Notifications: none in v1 unless DECISIONS Q7 says otherwise.
Step 4 (green), Step 5 (review), Step 6 (two-phone checklist BUILD_PLAN Phase 4, commit, push, PR "Phase 4: plans").
```

---

## Phase 5: Check-in

```
We are starting Phase 5 (check-in). CURRENT_PHASE is 5.

Read first: CLAUDE.md, docs/CONTRACTS.md "Phase 5" (the check ORDER in verify-checkin matters), docs/DECISIONS.md
(Q13, Q14, Q15, Q16, Q20), docs/BUILD_PLAN.md Phase 5 and risks R1, R2, R4.
Frozen spec (read fully): supabase/tests/database/050-phase5-checkins.test.sql,
tests/unit/phase5-checkin-rules.test.ts, tests/unit/phase5-checkin-messages.test.ts,
tests/integration/phase5-verify-checkin.test.ts. Earlier phases must keep passing.

Skills: `supabase` (Edge Functions + Storage policies) + `supabase-postgres-best-practices`, `frontend-design` for the
camera screen, `engineering:debug` for failing specs, `engineering:code-review` before the PR.

Step 1 (plan mode): migration, checkin_night, storage bucket + policies, shared rules module, Edge Function, camera
screen; map every assertion to code. Wait for approval.
Step 2 (red).
Step 3 (build):
 - checkins table + unique (user, venue, night), RLS: owner + friends + admins read, admins delete, no client writes.
 - checkin_night(venue, ts) in Europe/Sofia: start inclusive, end exclusive, crossing-midnight windows map early-morning
   times to the previous date. Summer-time nights must work.
 - Private bucket checkin-photos, path {user_id}/{checkin_id}.jpg, read policies: owner always, friends only for
   24h after created_at; no client uploads.
 - supabase/functions/_shared/checkin-rules.ts (pure TS, no Deno/Node APIs) exactly as CONTRACTS.
 - Edge Function verify-checkin: checks in the CONTRACTS order with the exact status codes, server time only,
   JPEG check + 2 MB limit, rate limit (>= 10 per user per minute allowed), upload with the service role, then insert.
 - CHECKIN_ERROR_CODES + Bulgarian messages for each.
 - Camera screen: live rear camera via getUserMedia, capture one frame to canvas, JPEG ~1280px long side.
   NO file input and NO gallery option anywhere. GPS via watchPosition (high accuracy, up to ~10 s, keep best fix with
   pickBestFix). Bulgarian hint when accuracy is poor ("go to the entrance and try again").
 - Show check-ins on the owner's profile and to friends (photo only within 24h).
Step 4 (green with --integration), Step 5 (review: focus on anything that trusts the client), Step 6 (phone checklist
BUILD_PLAN Phase 5, including at a real venue, commit, push, PR "Phase 5: check-in").
```

---

## Phase 6: Streaks and stats

```
We are starting Phase 6 (streaks and stats). CURRENT_PHASE is 6.

Read first: CLAUDE.md, docs/CONTRACTS.md "Phase 6", docs/DECISIONS.md (Q16-Q19), docs/BUILD_PLAN.md Phase 6.
Frozen spec: supabase/tests/database/060-phase6-streaks-stats.test.sql. Earlier phases must keep passing.

Skills: `supabase-postgres-best-practices` for the SQL functions, `frontend-design` (and optionally `dataviz`)
for the stats section, `engineering:code-review` before the PR.

Step 1 (plan mode): venue_streaks and user_stats design. Explain how you compute ISO weeks in Sofia time from
night_date (never from created_at), the "current week keeps it alive" rule, and the visibility check.
Map every assertion in 060 to code. Wait for approval.
Step 2 (red).
Step 3 (build): both functions as `security definer` + `set search_path = ''` with the access rules from CONTRACTS;
streak on each venue page and the profile; stats section; visibility toggle in settings.
Step 4 (green), Step 5 (review), Step 6 (phone checklist BUILD_PLAN Phase 6, commit, push, PR "Phase 6: streaks and stats").
```

---

## Phase 7: Safety and GDPR

**Before you paste:** answer DECISIONS Q21 (retention) and Q23 (data controller, contact, legal review).

```
We are starting Phase 7 (safety and GDPR). CURRENT_PHASE is 7.

Read first: CLAUDE.md, docs/CONTRACTS.md "Phase 7", docs/DECISIONS.md (Q20, Q21, Q23), docs/BUILD_PLAN.md Phase 7.
Frozen spec: supabase/tests/database/070-phase7-reports-deletion.test.sql,
tests/integration/phase7-delete-account.test.ts. Earlier phases must keep passing.

Skills: `supabase` + `supabase-postgres-best-practices`, `frontend-design` for report/delete/privacy screens,
`engineering:code-review` before the PR.

Step 1 (plan mode): reports table and policies, delete-account function, screens; map every assertion to code.
Also check EVERY foreign key in all earlier migrations: deleting an auth user must leave no row referencing them
(070 tests this). Wait for approval.
Step 2 (red).
Step 3 (build): reports + enums + one-target CHECK + RLS exactly as CONTRACTS; report buttons on profiles and photos;
admin review list (oldest first, mark reviewed, delete check-in); delete-account Edge Function (photos under
{user_id}/ first, then the auth user) with a Bulgarian confirmation step; privacy page in Bulgarian using the answers
in DECISIONS Q21/Q23, linked from sign-up and settings.
Step 4 (green with --integration), Step 5 (review), Step 6 (phone checklist BUILD_PLAN Phase 7, commit, push,
PR "Phase 7: safety and GDPR").
```

---

## Phase 8: Closed beta

**Before you paste:** answer DECISIONS Q2, Q24 and Q26.

```
We are preparing Phase 8 (closed beta for the first 20 AUBG users). CURRENT_PHASE is 8.

Read first: CLAUDE.md, docs/BUILD_PLAN.md Phase 8 checklist and section d (risks), docs/DECISIONS.md.

Skills: `engineering:deploy-checklist` to build the launch checklist, `engineering:documentation` for the
Bulgarian user guide, `supabase` for checking production settings.

1. Run `npm run test:spec -- --integration` for all phases and paste the summary.
2. Using engineering:deploy-checklist, turn the BUILD_PLAN Phase 8 checklist into docs/LAUNCH_CHECKLIST.md with a
   rollback plan, and mark which items need a human (field tests at each venue, two-phone checks).
3. Verify production Supabase: RLS enabled on every public table, no service-role key in the frontend bundle
   (search the build output), Auth providers and redirect URLs, Storage bucket private, backups for the chosen plan.
4. Write docs/BETA_GUIDE_BG.md: short Bulgarian guide (open link, add to home screen, allow camera and location).
5. List anything still open in DECISIONS.md. Commit, push, PR "Phase 8: closed beta prep". Do not merge.
```
