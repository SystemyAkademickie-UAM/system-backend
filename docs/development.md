# Development (backend)

## Stack versions

- **Node.js:** 24.x
- **NestJS:** 11.x

Use `.nvmrc` with nvm / nvm-windows; GitHub Actions uses Node 24.

## Workflow

1. Implement changes under `src/`.
2. Run `npm run start:dev` for watch mode.
3. Run `npm test` and `npm run test:e2e` before pushing.

Exercise endpoints with any HTTP client (curl, REST client, automated tests).

## CI

- `.github/workflows/ci.yml` — install, test, build on `push` / `pull_request` to `main`.
- `.github/workflows/docker-image.yml` — build and push the Docker image on `push` to `main`.

## Environment variables

| Variable      | Purpose                                 |
| ------------- | --------------------------------------- |
| `PORT`        | HTTP port (default `8080`)              |
| `CORS_ORIGIN` | Comma-separated allowed `Origin` values (no trailing slash). Defaults include the public UI host and local Vite origins; see `.env.example`. |

Never commit `.env`; only `.env.example`.
