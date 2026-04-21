# Docker (backend)

This document covers **only** the API image defined in this repository’s `Dockerfile`.

## Build and run

```bash
docker build -t system-backend:local .
docker run --rm -p 8080:8080 -e PORT=8080 system-backend:local
```

The process listens on **8080** inside the container (`PORT=8080`), which matches a host nginx `location /api/ { proxy_pass http://localhost:8080; ... }` when you publish `-p 127.0.0.1:8080:8080` (or equivalent).

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

The container listens on **8080**. The `Dockerfile` uses **Node.js 24.14.1** (Alpine) and **npm 11.11.0** during install, matching [prerequisites.md](./prerequisites.md).

## CORS

`CORS_ORIGIN` is a comma-separated list of allowed `Origin` values (no trailing slash). If unset, defaults include `http://maq.projektstudencki.pl`, `http://localhost:3000`, and `http://127.0.0.1:3000`. Add `https://maq.projektstudencki.pl` when the UI is served over HTTPS only.
