# system-backend

NestJS 11 (TypeScript) HTTP API for Systemy Akademickie UAM. Default URL: `http://127.0.0.1:8080`.

## Quick start

```bash
npm install
cp .env.example .env   # optional
npm run start:dev
```

## Documentation

Start with **[docs/prerequisites.md](./docs/prerequisites.md)** (Node.js **24.14.1**, npm **11.11.0**), then use the guides below. All Markdown except this file lives under `docs/`.

| Document | Description |
| -------- | ----------- |
| [docs/prerequisites.md](./docs/prerequisites.md) | Toolchain versions (install before `npm install`) |
| [docs/installation.md](./docs/installation.md) | Requirements and install |
| [docs/running.md](./docs/running.md) | Dev server, production run, tests |
| [docs/docker.md](./docs/docker.md) | Docker image for this service |
| [docs/development.md](./docs/development.md) | Tooling, CI, environment variables |
| [docs/api.md](./docs/api.md) | Requests and responses |

The SPA is a **separate** Git repository (**system-frontend**). Clone it alongside this repo for a full stack; its `docs/` cover UI install, `VITE_API_BASE_URL`, and Docker. Prerequisites versions match this repo by design.

## API (summary)

- `GET /api/counter/health` — smoke check `{ "ok": true }`
- `POST /api/counter/increment` — body `{ "currentCount": number }` → `{ "count": number }` (`201`)
- `POST /api/login` — SAML session cookie (`maqSamlSession`) + `X-Browser-ID` → `{ "auth": "<plaintext_opaque_once>" }; see [docs/api.md](./docs/api.md)`
- `GET /api/login/registration-status` — registration progress for authenticated user during `/login` wizard
- `POST /api/login/profile` — save nickname + avatar during `/login` wizard
- `POST /api/login/accept-eula` — accept EULA and complete registration during `/login` wizard
- `POST /api/logout` — clears `maq_auth` and SAML session cookies → `{ "success": true }`; see [docs/api.md](./docs/api.md)
- `POST /api/groups/new` — lecturer opaque bearer + JSON group payload → `{ "statusCode", "group" }; see [docs/api.md](./docs/api.md)`
- `POST /api/groups/generate-code` — lecturer session → `{ "statusCode", "code" }`; see [docs/api.md](./docs/api.md)
- `GET /api/groups/invite` — student entry code validation `?code=...` → `{ "statusCode", "code", "group" }`; see [docs/api.md](./docs/api.md)
- `POST /api/groups/enroll` — student opaque bearer + `groupId` → `{ "statusCode", "zapis" }` (`grywalizacja.zapisy`); see [docs/api.md](./docs/api.md)
- `POST /api/groups/:id/post` — lecturer opaque bearer + post payload → `{ "status", "post" }`; see [docs/api.md](./docs/api.md)
- `GET /api/groups/:id/post` — lecturer/student opaque bearer → `{ "status", "posts" }`; see [docs/api.md](./docs/api.md)
- `GET /api/groups/:groupId/student-profile` — student group-scoped profile → `{ "studentAccountId", "groupId", "lives", "currency", ... }`; see [docs/api.md](./docs/api.md)
- `POST /api/drive` — lecturer session; `multipart/form-data` fields `json` (string) and `banner` (file for `post`); see [docs/api.md](./docs/api.md)
- `POST /api/stages` — stage CRUD (method: post/modify/remove/retrieve); see [docs/api.md](./docs/api.md)
- `POST /api/activities` — activity CRUD (method: post/modify/remove/retrieve); see [docs/api.md](./docs/api.md)
- `GET /api/auth/saml/status` — SAML configuration checklist
- `GET /api/auth/saml/metadata` — SP metadata XML (PIONIER.id / IdP)
- `GET /api/auth/saml/login` — start SAML SSO (`302` to IdP)
- `POST /api/auth/saml/acs` — SAML Assertion Consumer Service
- `GET /api/auth/saml/me` — session JWT from cookie (smoke)
- `GET /api/auth/saml/bypass/status` — dev-only bypass flag + persona list (empty when disabled)
- `POST /api/auth/saml/bypass/session` — dev-only mint session cookie (`{ "persona": "student1" | … }`)

Details in [docs/api.md](./docs/api.md).

## License

[LICENSE.md](./LICENSE.md) (all rights reserved).

## Docker

Uruchomienie z testową bazą danych:
```bash
docker compose up --build
```

Uruchomienie testów e2e:
```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit
```
