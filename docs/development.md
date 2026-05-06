# Development (backend)

## Stack versions

- **Node.js / npm:** see [prerequisites.md](./prerequisites.md) (local toolchain pin).
- **NestJS:** 11.x

Use `.nvmrc` with nvm / nvm-windows. CI uses Node **24.14.1** (see `.github/workflows/ci.yml`).

## Workflow

1. Implement changes under `src/`.
2. Run `npm run start:dev` for watch mode.
3. Run `npm test` and `npm run test:e2e` before pushing.

Exercise endpoints with any HTTP client (curl, REST client, automated tests).

## PostgreSQL migrations (TypeORM)

With `TYPEORM_SYNC=false` (recommended outside throwaway dev), apply schema with:

```bash
npm run typeorm:migration:run
```

After `npm run build`, the same against compiled output:

```bash
npm run typeorm:migration:run:dist
```

Keep `TYPEORM_SYNC` off when using migrations to avoid drift. Optional `TYPEORM_MIGRATIONS_RUN=true` runs pending migrations on application startup (see `.env.example`).

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
