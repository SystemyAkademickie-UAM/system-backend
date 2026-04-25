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

## CI

- `.github/workflows/ci.yml` — install, test, build on `push` / `pull_request` to `main`.
- `.github/workflows/docker-build.yml` — verify a Docker image build on `push` to `main` (no registry push).
- `.github/workflows/docker-publish.yml` — build and push the image on `push` to `production` (GHCR).

## SAML proxy (optional)

To exercise **Nest SP → Shibboleth IdP** locally (LDAP users `staff1` / `password`), see `./infrastructure/saml-proxy-shibboleth/README.md` and set `SAML_*` variables in `.env` accordingly.

## Environment variables

| Variable      | Purpose                                 |
| ------------- | --------------------------------------- |
| `PORT`        | HTTP port (default `8080`)              |
| `CORS_ORIGIN` | Comma-separated allowed `Origin` values (no trailing slash). Defaults include the public UI host and local Vite origins; see `.env.example`. |

Never commit `.env`; only `.env.example`.
