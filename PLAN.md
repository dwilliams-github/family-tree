# Family Tree Web App — Implementation Plan

## Context

Greenfield hosted family tree application. The repo at `/home/dwilliams/family-tree` contains only a LICENSE and README. We are building from scratch: a React/TypeScript frontend hosted on S3+CloudFront, a Node/Express/TypeScript backend on AWS Elastic Beanstalk, and Aurora Serverless v2 (PostgreSQL) for storage. Two roles: `admin` (the owner's account) and `user` (read + own edits). Full audit trail on all data mutations.

---

## Stack Decisions

| Layer | Choice | Rationale |
|---|---|---|
| Frontend build | Vite + React + TypeScript | Modern, fast, standard |
| Styling | Tailwind CSS v4 + shadcn/ui | Utility classes + accessible pre-built components (Dialog, Sheet, Form, etc.) |
| Graph visualization | React Flow + dagre | Interactive graph with auto-layout, good TypeScript support |
| Backend framework | Express + TypeScript | Straightforward, well-known |
| ORM | Drizzle ORM | Lightweight, TypeScript-first, SQL migrations checked into git |
| Database | PostgreSQL 15 on EC2 (co-located) | Same instance as backend, ~$0 extra, daily pg_dump → S3 for backups |
| Auth | JWT in localStorage, 7-day expiry | Simple for separate frontend/backend origins |
| State / data fetching | TanStack Query | Cache invalidation on mutations |
| Forms | React Hook Form + zod | Type-safe validation |
| Infrastructure | AWS CDK (TypeScript) | Versioned, repeatable deploys — single EC2Stack + FrontendStack |
| Email | AWS SES + nodemailer | Invite emails; SES in sandbox during dev, verified domain in prod |
| CI/CD | GitHub Actions | Push-to-main triggers full deploy |

---

## Monorepo Structure

```
family-tree/
├── package.json                    # npm workspaces root
├── tsconfig.base.json
├── docker-compose.yml              # local Postgres for dev
├── packages/
│   ├── shared/                     # @family-tree/shared — types only (no runtime code)
│   │   └── src/types/              # Person, Relationship, AuditEntry, JwtPayload DTOs
│   ├── backend/
│   │   └── src/
│   │       ├── db/
│   │       │   ├── schema.ts       # *** Drizzle table definitions — single source of truth ***
│   │       │   ├── migrate.ts      # run migrations at startup
│   │       │   ├── client.ts       # pg pool + Drizzle singleton
│   │       │   └── migrations/     # generated SQL (drizzle-kit output)
│   │       ├── middleware/
│   │       │   ├── auth.ts         # JWT verify → req.user
│   │       │   └── adminOnly.ts    # role gate
│   │       ├── routes/
│   │       │   ├── auth.ts         # /api/auth/*
│   │       │   ├── persons.ts      # /api/persons/*
│   │       │   ├── relationships.ts
│   │       │   ├── tree.ts         # /api/tree (graph query)
│   │       │   └── audit.ts        # /api/audit/* (admin only)
│   │       └── services/           # all DB access + audit writes live here
│   │           ├── authService.ts
│   │           ├── personService.ts    # *** audit-in-transaction pattern — replicate to others ***
│   │           ├── relationshipService.ts
│   │           ├── treeService.ts      # recursive CTE query
│   │           └── auditService.ts
│   ├── frontend/
│   │   └── src/
│   │       ├── api/                # axios client + per-resource API modules
│   │       ├── auth/               # AuthContext, ProtectedRoute
│   │       ├── components/
│   │       │   ├── tree/
│   │       │   │   ├── FamilyTree.tsx       # *** orchestrates fetch → transform → layout → ReactFlow ***
│   │       │   │   ├── PersonNode.tsx       # 160×80 compact card
│   │       │   │   ├── PersonEdge.tsx       # conditional stroke by relationship type
│   │       │   │   ├── treeTransform.ts     # *** GraphDTO → RF nodes/edges ***
│   │       │   │   └── treeLayout.ts        # dagre layout (called once per fetch, not per render)
│   │       │   ├── person/         # PersonPopup, PersonForm, PersonAvatar
│   │       │   ├── relationship/   # RelationshipPanel, AddRelationshipForm
│   │       │   └── audit/          # AuditLogViewer
│   │       ├── hooks/              # useTree, usePerson, useAudit (TanStack Query)
│   │       └── pages/              # TreePage, LoginPage, AdminPage
└── infra/                          # CDK stacks (EC2 → Frontend)
    └── src/stacks/
        ├── EC2Stack.ts             # t4g.small, security groups, IAM role for S3 backup writes
        └── FrontendStack.ts        # S3, CloudFront OAC
```

---

## Database Schema

### `users`
```
id             UUID PK
email          TEXT NOT NULL UNIQUE
password_hash  TEXT NOT NULL
role           TEXT NOT NULL DEFAULT 'user'   -- 'user' | 'admin'
display_name   TEXT
created_at     TIMESTAMPTZ
updated_at     TIMESTAMPTZ
```
Admin account seeded at startup from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars. **No public registration** — accounts are created via email invitation only (admin sends invite, recipient sets password via link).

### `invitations`
```
id          UUID PK
email       TEXT NOT NULL
token       TEXT NOT NULL UNIQUE   -- securely random, 32 bytes hex
invited_by  UUID → users.id
expires_at  TIMESTAMPTZ NOT NULL   -- 48 hours from creation
accepted_at TIMESTAMPTZ            -- NULL until accepted
created_at  TIMESTAMPTZ

INDEX on token
```

### `persons`
```
id              UUID PK
first_name      TEXT NOT NULL
last_name       TEXT
birth_name      TEXT          -- maiden/birth name
gender          TEXT          -- 'male' | 'female' | 'other' | null
date_of_birth   DATE
date_of_death   DATE
place_of_birth  TEXT
place_of_death  TEXT
bio             TEXT
photo_data      BYTEA                  -- compressed image binary (JPEG/PNG/WebP)
photo_mime_type TEXT                   -- 'image/jpeg' | 'image/png' | 'image/webp'
is_living       BOOLEAN DEFAULT TRUE
created_by      UUID → users.id
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### `relationships`
```
id                UUID PK
person_a_id       UUID → persons.id ON DELETE CASCADE
person_b_id       UUID → persons.id ON DELETE CASCADE
relationship_type TEXT          -- 'parent_child' | 'spouse' | 'sibling'
person_a_role     TEXT          -- 'parent', 'spouse', 'sibling'
person_b_role     TEXT          -- 'child', 'spouse', 'sibling'
start_date        DATE
end_date          DATE
notes             TEXT
created_by        UUID → users.id
created_at        TIMESTAMPTZ

UNIQUE (person_a_id, person_b_id, relationship_type)
CHECK (person_a_id <> person_b_id)
```
Convention: for `parent_child`, person_a is always the parent. For `spouse`/`sibling`, the lower UUID is always person_a (enforced by service layer to satisfy the unique constraint).

### `audit_log`
```
id              UUID PK
table_name      TEXT            -- 'persons' | 'relationships'
record_id       UUID            -- not a FK — survives record deletes
action          TEXT            -- 'INSERT' | 'UPDATE' | 'DELETE'
performed_by    UUID → users.id
previous_state  JSONB           -- NULL on INSERT
new_state       JSONB           -- NULL on DELETE
changed_fields  TEXT[]          -- column names that changed (UPDATE only)
ip_address      TEXT
created_at      TIMESTAMPTZ

INDEX on (table_name, record_id)
INDEX on record_id
INDEX on created_at DESC
```
Audit writes happen in the **service layer within the same transaction** as the data mutation — no DB triggers. This keeps `userId` available and produces typed JSONB from the same TS objects.

---

## API Routes

### Auth `/api/auth`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/login` | None | Email + password, returns JWT |
| GET | `/me` | JWT | Current user profile |
| POST | `/invite` | Admin | Send invite email to an address |
| GET | `/invite/:token` | None | Validate token, return associated email |
| POST | `/invite/:token/accept` | None | Set password, create account, return JWT |

### Persons `/api/persons`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | JWT | List all (summary fields, no blob) |
| GET | `/:id` | JWT | Full detail (no blob) |
| POST | `/` | JWT | Create person |
| PUT | `/:id` | JWT | Update person |
| DELETE | `/:id` | Admin | Delete person |
| GET | `/search?q=` | JWT | Search by name |
| GET | `/:id/photo` | JWT | Serve photo — streams `photo_data` with `Content-Type: photo_mime_type` |
| PUT | `/:id/photo` | JWT | Upload photo — `multipart/form-data`, server resizes to max 800px, stores JPEG |
| DELETE | `/:id/photo` | JWT | Remove photo |

Photo upload resizes server-side (using `sharp`) to max 800px on the longest edge and re-encodes as JPEG before storing — keeps blobs small regardless of what the user uploads. `GET /persons` and `GET /persons/:id` never include the blob; the frontend uses `<img src="/api/persons/:id/photo">` with the JWT in the request header.

Any authenticated user can create, edit, or upload photos for any person. Hard delete is admin-only. All mutations are audit-logged — the revert script is the conflict resolution tool.

### Relationships `/api/relationships`
Standard CRUD — any authenticated user can create, edit, or delete relationships. All mutations audit-logged.

### Tree `/api/tree`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | JWT | Full graph: all persons + relationships |
| GET | `/:personId` | JWT | Subgraph rooted at personId (recursive CTE, depth ≤ 10) |

Response: `{ persons: Person[], relationships: Relationship[] }`

### Audit `/api/audit` (admin only)
| Method | Path | Description |
|---|---|---|
| GET | `/` | Paginated full log |
| GET | `/record/:recordId` | History for one person/relationship |
| POST | `/record/:recordId/undo` | JWT | Revert the most recent change to this record **if it was made by the requesting user** — applies `previous_state`, writes a new audit entry; returns 403 if the last change was by someone else |

---

## Tree Visualization Data Flow

```
GET /api/tree
  → treeTransform.ts
      personsToNodes()      → Node<PersonNodeData>[]  (position: {x:0, y:0})
      relationshipsToEdges() → Edge[]
  → treeLayout.ts
      applyDagreLayout(nodes, edges, { rankdir: 'TB', nodeSep: 60, rankSep: 100 })
      → nodes with dagre-computed x/y positions
  → <ReactFlow nodes={layoutNodes} edges={edges}
               nodeTypes={{ personNode: PersonNode }}
               edgeTypes={{ personEdge: PersonEdge }}
               onNodeClick={handleNodeClick} />
```

Node size: 160×80px. Layout memoized on raw API response (not recomputed on every render).

On node click → `selectedPersonId` state → `PersonPopup` slide-over with `GET /api/persons/:id`.

---

## Implementation Phases

### Phase 0 — Dev Environment (Linux / Ubuntu 24.04) ✅

The host has Docker + Docker Compose + Python 3.12 but no Node.js. Use `nodeenv` to create an isolated Node.js environment inside the project directory (no system-wide install, no nvm):

```bash
pip3 install nodeenv              # install the nodeenv tool
nodeenv .nodeenv --node=20.19.2   # create isolated Node 20 LTS in project dir
source .nodeenv/bin/activate      # activate (prepends .nodeenv/bin to PATH)
```

`.nodeenv/` is gitignored. Anyone cloning the repo runs the same three commands to get an identical environment. Activate with `source .nodeenv/bin/activate` at the start of each dev session (or add to `.envrc` if using direnv).

### Phase 1 — Monorepo Scaffold + Dev Harness ✅
- Root `package.json` with npm workspaces: `["packages/*", "infra"]`
- `tsconfig.base.json` (strict, ES2022)
- `packages/shared` — types only, no runtime code
- `packages/backend` — Express, `GET /api/health` returns `{"status":"ok"}`
- `packages/frontend` — Vite + React, renders heading
- ESLint + Prettier across all packages

**Dev harness (`docker-compose.yml` + root scripts):**
- `docker-compose.yml` — Postgres 15-alpine on port 5432, named volume for persistence, `POSTGRES_DB=family_tree_dev`
- Install `concurrently` at root
- `packages/backend`: `ts-node-dev --respawn src/server.ts` for hot reload
- `packages/frontend/vite.config.ts`: proxy `/api` → `http://localhost:3000` (eliminates CORS in dev)
- Root scripts:
  ```json
  "dev": "docker compose up -d && concurrently -n backend,frontend \"npm run dev -w packages/backend\" \"npm run dev -w packages/frontend\"",
  "db:migrate": "npm run migrate -w packages/backend",
  "db:seed": "npm run seed -w packages/backend"
  ```
- `.env.example` files in `packages/backend/` with local defaults: `DATABASE_URL`, `JWT_SECRET`, `PORT`
- `packages/backend/.env` is gitignored; copied from `.env.example` on first setup

### Phase 2 — Database + ORM ✅
- Drizzle ORM + drizzle-kit in backend
- `db/schema.ts` — all four tables
- `drizzle-kit generate` → `migrations/0001_initial.sql`
- `db/migrate.ts` — runs pending migrations at startup
- `db/client.ts` — pg pool + Drizzle singleton
- `scripts/seed.ts` — create admin, insert 5–10 sample persons + relationships
- `scripts/revert.ts` — ad-hoc admin tool: given an `audit_log` entry ID, applies `previous_state` back to the target table and writes a new audit row recording the revert

### Phase 3 — Backend Auth ✅
- `config.ts` — zod env var validation
- `services/authService.ts` — bcrypt hash/verify, JWT sign/verify
- `services/emailService.ts` — nodemailer + SES transport
- `middleware/auth.ts`, `middleware/adminOnly.ts`
- `routes/auth.ts` — login, invite, accept, me

### Phase 4 — Persons, Relationships, Tree API ✅
- `services/auditService.ts` — writes inside caller's transaction
- `services/personService.ts` — CRUD with audit
- `services/relationshipService.ts` — same pattern
- `services/treeService.ts` — full tree + recursive CTE subgraph
- All route files wired into app

### Phase 5 — Frontend Foundation ✅
- React Router, Axios, TanStack Query, React Hook Form, zod
- Tailwind CSS v4 + shadcn/ui
- AuthContext, ProtectedRoute, LoginPage, AcceptInvitePage

### Phase 6 — Tree Visualization ✅
- `treeTransform.ts`, `treeLayout.ts`
- `PersonNode.tsx` (160×80 card), `PersonEdge.tsx`
- `FamilyTree.tsx` — full React Flow canvas

### Phase 7 — Person Detail + CRUD UI ✅
- `PersonPopup.tsx` — shadcn Sheet slide-over
- `PersonForm.tsx` — Dialog + React Hook Form + zod
- `PhotoUpload.tsx` — multipart upload, server-side resize via sharp
- `RelationshipPanel.tsx` + `AddRelationshipForm.tsx`

### Phase 8 — Admin / Audit UI ✅
- `InviteUserForm.tsx` — invite by email
- `AuditLogViewer.tsx` — paginated table with JSON diff
- `AdminPage.tsx` — admin-only route

### Phase 9 — CDK Infrastructure ✅
- `infra/src/stacks/EC2Stack.ts` — t4g.small, EBS data volume (RETAIN), Elastic IP, Route53 A record, DLM snapshots, GitHub OIDC deploy role
- `infra/DEPLOY.md` — first-time setup + operations guide

### Phase 10 — Deployment Pipeline ✅
- `packages/backend/ecosystem.config.cjs` — PM2 config with `--env-file`
- `scripts/deploy-server.sh` — runs on EC2 via SSM: download artifact, npm ci, prisma migrate, pm2 restart
- `.github/workflows/deploy.yml` — build → S3 upload → SSM Run Command → poll for success

---

## Key Architectural Notes

**Single EC2 deployment (~$12-15/month total):** PostgreSQL 15 and Node.js run on the same `t4g.small` instance. Postgres data lives on a dedicated EBS volume — survives instance termination, snapshotted daily by AWS DLM (no cron). A weekly pg_dump to S3 provides a portable logical backup for surgical restores. Frontend is served by Express as static files in production. PM2 manages the Node.js process (auto-restart on crash, start on boot, log rotation).

**Photo storage:** Photos stored as BYTEA in Postgres, resized server-side to max 800px via `sharp`, served via `GET /api/persons/:id/photo` with JWT auth. No S3 presigned URL complexity.

**No public registration.** Only the admin can invite users via `POST /api/auth/invite`. The login page is the only public-facing entry point.

**Seed data security:** `seed.txt` and `packages/backend/src/scripts/seed.ts` are gitignored — they contain real family personal data (names, dates, addresses).

**Deployment flow:** Push to `main` → GitHub Actions builds → uploads tarball to S3 → SSM Run Command on EC2 instance → downloads, extracts, `npm ci`, `prisma migrate deploy`, `pm2 restart`. No SSH keys needed; auth via IAM OIDC role locked to the `main` branch.
