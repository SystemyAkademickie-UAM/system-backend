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

The container listens on **8080**. The `Dockerfile` uses **Node.js 24.14.1** (Alpine) and **npm 11.11.0** during install, matching [prerequisites.md](../first-setup/prerequisites.md).

## CORS

`CORS_ORIGIN` is a comma-separated list of allowed `Origin` values (no trailing slash). If unset, defaults include `http://maq.projektstudencki.pl`, `http://localhost:3000`, and `http://127.0.0.1:3000`. Add `https://maq.projektstudencki.pl` when the UI is served over HTTPS only.

## Developer compose (API + UI from source)

For a **two-container** stack on your laptop (same layout as production, but built locally), use the repo root file **`docker-compose.dev.yml`** next to this `docs/` folder (i.e. in `system-backend/`):

1. Clone **system-frontend** as a **sibling** of **system-backend** (Compose build context `../system-frontend`).
2. `cp .env.example .env` and edit (set `SAML_SESSION_JWT_SECRET` to a long random string).
3. **SAML dev material:** Put Nest SP / IdP signing **`*.pem`** files in **`../secrets/saml/`** and Shibboleth **`idp-credentials/`** files in **`../secrets/saml-proxy-shibboleth/idp-credentials/`** (workspace root — **not** inside the backend Git repo). The API compose mounts **`../secrets`** at **`/app/secrets`**. The Shibboleth stack mounts **`idp-credentials`** at **`/opt/shibboleth-idp/credentials`**. See workspace **`secrets/README.md`**.
4. **Optional — one command from the workspace:** `fs-scripts/docker-full-stack.ps1` (Windows) or `fs-scripts/docker-full-stack.sh` (builds SAML + API + UI; see `fs-scripts/README.md`).
5. Run: `docker compose -f docker-compose.dev.yml up --build`  
   - UI: `http://127.0.0.1:3000` (built with `VITE_API_BASE_URL=http://127.0.0.1:8080/api`)  
   - API: `http://127.0.0.1:8080/api`

Optional **Shibboleth proxy** for SAML: `infrastructure/saml-proxy-shibboleth/docker-compose.yml` (separate compose; IdP on host port **14443**). See that directory’s `README.md`.

## Production compose (GHCR images + host nginx)

Typical host file:

```yaml
services:
  backend:
    image: ghcr.io/systemyakademickie-uam/system-backend:latest
    env_file: [.env]
    ports: ["127.0.0.1:8080:8080"]
    volumes:
      - /opt/maq/secrets:/app/secrets:ro
  frontend:
    image: ghcr.io/systemyakademickie-uam/system-frontend:latest
    depends_on: [backend]
    ports: ["127.0.0.1:3000:3000"]
```

**Adjustments you usually need beyond that template:**

| Area | What to change |
| ---- | ---------------- |
| **Frontend build** | The published UI image must be built with `VITE_API_BASE_URL` set to the **browser-visible** API base (e.g. `https://your.domain/api`). Rebuild/push the frontend image when the public URL or path prefix changes. |
| **CORS** | In `.env` for the backend, set `CORS_ORIGIN` to the exact `Origin` the browser sends for the SPA (scheme + host + port), comma-separated if several. |
| **SAML file paths** | Put PEM material under `/opt/maq/secrets/...` on the host and reference **`/app/secrets/...`** inside the container (same mount you already use). Set all required `SAML_*` variables per [api.md](../api/api.md). |
| **`SAML_ENTRY_POINT`** | Must be a URL the **end-user browser** can open (often your public IdP hostname behind nginx), not an internal Docker DNS name unless that hostname resolves for clients. |
| **ACS URL** | `SAML_ACS_URL` must match what you register at the IdP (public `https://…/api/auth/saml/acs` if TLS terminates at nginx). |
| **Optional proxy IdP** | If you run the Shibboleth stack on the same or another machine, add a service (or separate compose), expose TLS, register SP metadata with the proxy, and point `SAML_ENTRY_POINT` / `SAML_IDP_CERT` at the **proxy** IdP, not UAM, when using the proxy pattern. |
