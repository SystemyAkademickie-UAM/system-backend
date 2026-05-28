# Development (backend)

## Stack versions

- **Node.js / npm:** see [prerequisites.md](./prerequisites.md) (local toolchain pin).
- **NestJS:** 11.x

Use `.nvmrc` with nvm / nvm-windows. CI uses Node **24.14.1** (see `.github/workflows/ci.yml`).

## Workflow

1. One-time: [create the Docker network](./installation.md#docker-compose-local-postgresql) and copy `.env` from `.env.example`.
2. Implement changes under `src/`.
3. Run `npm run start:dev` for watch mode (starts local Postgres, runs migrations, then Nest).
4. Run `npm test` and `npm run test:e2e` before pushing.

Exercise endpoints with any HTTP client (curl, REST client, automated tests).

## PostgreSQL migrations (TypeORM)

**Baseline:** `maq.sql` at the repo root is a full schema dump for **fresh** local Docker Postgres only (`docker compose` `db` service init). It already includes the schema through the `001-baseline` cutover. Do not use it to update production or remote databases.

**Incremental changes:** add numbered files under `src/database/migrations/` (`0000000000002-…`, etc.). Filenames and class names use a **13-digit prefix** (TypeORM requirement); `0000000000001` is the baseline, `0000000000002` syncs schema changes from main. Put SQL in `UP_SQL` / `DOWN_SQL` constants (see existing migrations).

Scaffold the next file:

```bash
npm run migration:new -- add-column-example
```

Local rollback of the last migration (dev only): `npm run typeorm:migration:revert`.

With PostgreSQL configured and `TYPEORM_SYNC=false`, pending migrations are applied automatically when you use `npm run start`, `npm run start:dev`, `npm run start:prod`, or the Docker API container (see below). To run them manually:

```bash
npm run migrate
```

After `npm run build`, against compiled output:

```bash
npm run migrate:dist
```

Keep `TYPEORM_SYNC` off when using migrations to avoid drift. Optional `TYPEORM_MIGRATIONS_RUN=true` runs pending migrations on application startup (see `.env.example`).

**New local DB:** `docker compose down -v` then `docker compose up -d --build` (or `npm run docker:rebuild`) loads `maq.sql`; the API container records `001-baseline` on first start.

## Docker Compose (local full stack)

One-time network setup: see [installation.md](./installation.md#docker-compose-local-postgresql).

| Command | DB + migrations |
| ------- | ----------------- |
| `npm run start:dev` / `start:debug` | `db:up` → `migrate` → Nest (watch) |
| `npm run start` | `db:up` → `migrate` → Nest (no watch) |
| `npm run db:up` | Starts/waits for Compose `db` only |
| `docker compose up -d --build` / `npm run docker:build` | Dockerfile `CMD`: `migrate:dist` → API |
| `npm run docker:rebuild` | Fresh volume + `maq.sql`; baseline on first API start |

## CI

- `.github/workflows/ci.yml` — install, test, build on `push` / `pull_request` to `main`.
- `.github/workflows/docker-build.yml` — verify a Docker image build on `push` to `main` (no registry push).
- `.github/workflows/docker-publish.yml` — build and push the image on `push` to `production` (GHCR).

## Environment variables

| Variable      | Purpose                                 |
| ------------- | --------------------------------------- |
| `PORT`        | HTTP port (default `8080`)              |
| `CORS_ORIGIN` | Comma-separated allowed `Origin` values (no trailing slash). Defaults include the public UI host and local Vite origins; see `.env.example`. |

Never commit `.env`; only `.env.example`.
