# iHodim

A social web app for nights out. Friends say where they're going ("Friday, Club X, with Ivan and Maria"), everyone taps **Going / Maybe / Out**, and the confusion over who's coming is gone.

Launching first in **Blagoevgrad** with AUBG students and 5–6 local clubs.

- Product decisions and rules for contributors (and for Claude Code): see [CLAUDE.md](CLAUDE.md)
- Stack: React + Vite PWA (TypeScript), Supabase (EU), hosted on Cloudflare Workers (static assets, see `wrangler.jsonc`). Build plan: [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md)

## Quickstart (fresh clone)

You need:

- **Node 22.** Install it with [nvm-windows](https://github.com/coreybutler/nvm-windows) (`nvm install 22 && nvm use 22`) or [fnm](https://github.com/Schniz/fnm) (`fnm use`, which reads `.nvmrc`). `npm install` fails on any other Node version (`engine-strict`).
- **Docker Desktop**, running. The local Supabase stack runs in Docker.

```
cp .env.example .env          # fill in the Supabase URL and anon key (never the service-role key)
npm install
npm run dev                   # the app; /spike is the phone camera + GPS test (dev and Workers preview builds only)
```

Database and spec:

```
npx supabase start            # local Supabase (first run downloads the images)
npm run types:gen             # regenerate src/lib/database.types.ts after a migration
npm run test:spec             # frozen spec for phases 0..CURRENT_PHASE
npm run test:spec -- --integration
```

Other scripts: `npm run typecheck`, `npm run lint`, `npm run format`, `npm test` (our own tests in `src/`), `npm run build`, `npm run preview`.

Deploys happen on Cloudflare (Workers Builds): pushes to `main` go to production, every other branch gets a Preview URL. To serve the built app locally exactly as Cloudflare does (SPA routing included): `npm run build && npx wrangler dev`.

## Working on this repo

```
git switch main && git pull          # always start from the latest main
git switch -c feature/<short-name>   # one branch per feature
# ...work, commit...
git push -u origin feature/<short-name>
# open a Pull Request on GitHub; the other person reviews and merges
```

Never commit directly to `main`. Never commit `.env` files or keys.
