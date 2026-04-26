# system-backend

NestJS 11 (TypeScript) HTTP API for Systemy Akademickie UAM. Default URL: `http://127.0.0.1:8080`.

## Quick start

```bash
npm install
cp .env.example .env   # optional
npm run start:dev
```

## Documentation

Start with **[docs/first-setup/prerequisites.md](./docs/first-setup/prerequisites.md)** (Node.js **24.14.1**, npm **11.11.0**), then use the index below. All Markdown except this file lives under `docs/`.

| Document | Description |
| -------- | ----------- |
| [docs/README.md](./docs/README.md) | Documentation index |
| [docs/first-setup/prerequisites.md](./docs/first-setup/prerequisites.md) | Toolchain versions (install before `npm install`) |
| [docs/first-setup/installation.md](./docs/first-setup/installation.md) | Requirements and install |
| [docs/development/running.md](./docs/development/running.md) | Dev server, production run, tests |
| [docs/docker/docker.md](./docs/docker/docker.md) | Docker image for this service |
| [docs/development/development.md](./docs/development/development.md) | Tooling, CI, environment variables |
| [docs/api/api.md](./docs/api/api.md) | Requests and responses |

The SPA is a **separate** Git repository (**system-frontend**). Clone it alongside this repo for a full stack; its `docs/` cover UI install, `VITE_API_BASE_URL`, and Docker. Prerequisites versions match this repo by design.

## API (summary)

- `GET /api/counter/health` — smoke check `{ "ok": true }`
- `POST /api/counter/increment` — body `{ "currentCount": number }` → `{ "count": number }` (`201`)
- `GET /api/auth/saml/status` — SAML configuration checklist
- `GET /api/auth/saml/metadata` — SP metadata XML (PIONIER.id / IdP)
- `GET /api/auth/saml/login` — start SAML SSO (`302` to IdP)
- `POST /api/auth/saml/acs` — SAML Assertion Consumer Service
- `POST /api/auth/saml/logout` — clears `maqSamlSession` cookie (app logout)
- `GET /api/auth/saml/me` — session JWT from cookie (smoke)

Details in [docs/api/api.md](./docs/api/api.md).

## License

[LICENSE.md](./LICENSE.md) (all rights reserved).
