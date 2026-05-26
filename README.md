# Family Tree

A private, invite-only web app for browsing and editing a family tree. Features an interactive graph visualization, person profiles with photos, relationship management, and a full audit trail of all changes.

Live at **https://tree.slashdave.com**

---

## Directory Layout

```
packages/
  shared/       Shared TypeScript types (@family-tree/shared)
  backend/      Express API server + Prisma ORM + PostgreSQL
  frontend/     React + Vite SPA (served by the backend in production)

infra/          AWS CDK stack — EC2, EBS, Elastic IP, Route 53, DLM, IAM
scripts/        Server-side deploy script (runs on EC2 via SSM)
.github/        GitHub Actions workflow (build → S3 → SSM deploy)
```

## Local Development

**Prerequisites:** Docker, Docker Compose, Python 3 (for nodeenv)

```bash
# One-time setup
pip3 install nodeenv
nodeenv .nodeenv --node=20.19.2
source .nodeenv/bin/activate
npm install
cp packages/backend/.env.example packages/backend/.env
# Edit packages/backend/.env — set DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD

# Start Postgres + backend + frontend (hot reload)
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000/api/health

## Deployment

See [infra/DEPLOY.md](infra/DEPLOY.md) for first-time AWS setup and ongoing deployment instructions.

Pushes to `main` deploy automatically via GitHub Actions.

## How This Was Built

The entire application — from empty repository to a deployed, production-ready web app — was written in a single afternoon using [Claude Code](https://claude.ai/code) (model: `claude-sonnet-4-6`). No code was written by hand. The session covered monorepo scaffolding, database schema, auth, API, React frontend, tree visualization, admin UI, AWS CDK infrastructure, and a GitHub Actions deployment pipeline.

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS, shadcn/ui, React Flow |
| Backend | Node.js 20, Express, TypeScript, Prisma |
| Database | PostgreSQL 15 (co-located on EC2, data on separate EBS volume) |
| Infrastructure | AWS CDK — EC2 t4g.small, Elastic IP, Route 53, DLM snapshots |
| CI/CD | GitHub Actions → S3 artifact → SSM Run Command (keyless OIDC) |
