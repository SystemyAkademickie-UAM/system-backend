# Docker (backend)

## Compose network (local stack)

`docker-compose.yml` uses an **external** network. Create it once before the first Compose run:

```bash
docker network create academy-network
```

See also [installation.md](./installation.md#docker-compose-local-postgresql).

## Build and run (API image only)

```bash
docker build -t system-backend:local .
docker run --rm -p 8080:8080 -e PORT=8080 system-backend:local
```

The process listens on **8080** inside the container (`PORT=8080`), which matches a host nginx `location /api/ { proxy_pass http://localhost:8080; ... }` when you publish `-p 127.0.0.1:8080:8080` (or equivalent).

The image sets **`NODE_ENV=production`**. For local Compose, set **`NODE_ENV=development`** in `.env` when you need dev SAML bypass (`SAML_BYPASS_ENABLED=true`). For production, keep **`NODE_ENV=production`** in `.env`.

## Helper scripts (Docker CLI only)

From this service directory (`system-backend`, where this `docs/` folder lives next to `scripts/`):

| Platform   | Command |
| ---------- | ------- |
| Linux/macOS | `./scripts/docker-local.sh` |
| Windows (PowerShell) | `.\scripts\docker-local.ps1` |

Optional: set `IMAGE_NAME` to override the image tag. For extra `docker run` flags, call `docker build` / `docker run` yourself using the same pattern as above.

## CI image

- `.github/workflows/docker-build.yml` — builds this Dockerfile on `push` to `main` (verification only).
- `.github/workflows/docker-publish.yml` — builds and pushes on `push` to `production` (for example to GHCR).

The process listens on **8080**. The `Dockerfile` uses **Node.js 24.14.1** (Alpine) and **npm 11.11.0** during install, matching [prerequisites.md](./prerequisites.md).

On container start, the `Dockerfile` `CMD` runs pending TypeORM migrations (`npm run migrate:dist`), then starts the API. Failed migrations stop the container (the API does not start on a stale schema). All connection settings come from `.env` via Compose `env_file`.

## CORS

`CORS_ORIGIN` is a comma-separated list of allowed `Origin` values (no trailing slash). If unset, defaults include `http://maq.projektstudencki.pl`, `http://localhost:3000`, and `http://127.0.0.1:3000`. Add `https://maq.projektstudencki.pl` when the UI is served over HTTPS only.
