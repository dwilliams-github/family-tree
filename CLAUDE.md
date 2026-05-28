# Claude Code Instructions

## Security — seed data (mandatory)

`seed.txt` and `packages/backend/src/scripts/seed.ts` contain real personal data (names, dates of birth, addresses). They are gitignored and must stay that way. Never commit, log, or transmit their contents.

## Key documents

- [README.md](README.md) — project overview and local dev setup
- [PLAN.md](PLAN.md) — full architecture and implementation history
- [infra/DEPLOY.md](infra/DEPLOY.md) — AWS deployment guide

## Dev workflow

Node is isolated in `.nodeenv/` — activate before running any `node`/`npm` commands:

```bash
source .nodeenv/bin/activate
```

Start the dev environment (Postgres + backend + frontend):

```bash
docker compose up -d
npm run dev
```

## Before pushing

Always verify the build is clean before committing:

```bash
npm run build
```

Use PRs for large refactors or anything that needs a local dev cycle first. Direct pushes to `main` are fine for small focused changes.

## Deployment

All 10 phases are complete. Pushing to `main` triggers GitHub Actions, which builds and deploys to `tree.slashdave.com` via SSM. See [infra/DEPLOY.md](infra/DEPLOY.md) for first-time AWS setup.
