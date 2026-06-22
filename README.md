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
| [docs/openapi.md](./docs/openapi.md) | Swagger UI at `/api/docs`, coverage, auth in Try-it-out |

The SPA is a **separate** Git repository (**system-frontend**). Clone it alongside this repo for a full stack; its `docs/` cover UI install, `VITE_API_BASE_URL`, and Docker. Prerequisites versions match this repo by design.

## API (summary)

- `GET /api/counter/health` — smoke check `{ "ok": true }`
- **OpenAPI UI** — `GET /api/docs` (dev by default; see [docs/openapi.md](./docs/openapi.md))
- `POST /api/counter/increment` — body `{ "currentCount": number }` → `{ "count": number }` (`201`)
- Session established by SAML ACS or magic link verification; stored in `auth.sessions`; delivered via `maq_session` cookie
- `GET /api/login/organizations?loginMethod=saml|email` — institution picker from `auth.organizations` (one row per tenant)
- `POST /api/login/magic-link/request` — body `{ "email" }`; organization resolved from provisioned account (SMTP required; 404 if not registered)
- `POST /api/login/magic-link/verify` — consume magic link token → `{ "session": "<plaintext>" }` + `maq_session` cookie
- `GET /api/login/me` — session check from `maq_session` cookie (returns user profile and active role)
- `GET /api/login/registration-status` — registration progress during `/login` wizard (includes `profileSubmitted`)
- `POST /api/login/profile` — save nickname + avatar during `/login` wizard (sets `profileSubmitted`)
- `POST /api/login/accept-eula` — accept EULA and complete registration
- `GET /api/profile` — authenticated user profile (soft auth)
- `POST /api/logout` — revokes session and clears `maq_session` cookie → `{ "success": true }`; see [docs/api.md](./docs/api.md)
- `GET /api/groups` — authenticated user group list → `{ "statusCode", "groups" }`; see [docs/api.md](./docs/api.md)
- `POST /api/groups/new` — lecturer opaque bearer + JSON group payload → `{ "statusCode", "group" }`; see [docs/api.md](./docs/api.md)
- `GET /api/groups/:groupId/enrollment-codes` — lecturer CRUD for invite codes (`education.enrollment_codes`); see [docs/api.md](./docs/api.md)
- `POST /api/groups/:groupId/enroll` — student enrollment → `{ "statusCode", "enrollmentId" }`; see [docs/api.md](./docs/api.md)
- `GET /api/groups/:groupId/invite?code=` — student join by enrollment code → `{ "statusCode", "enrollmentId", "groupId?" }`
- `POST /api/groups/:id/post` — lecturer: create post (with `createdAt` from frontend); starts unpublished → `{ "status", "post" }`
- `GET /api/groups/:id/post` — lecturer sees all posts; students see only published → `{ "status", "posts" }`
- `PATCH /api/groups/:id/post/:postId` — lecturer: update post title/content/isPublished; setting `isPublished: true` auto-sets `publishedAt`
- `DELETE /api/groups/:id/post/:postId` — lecturer: delete post
- `GET /api/groups/:groupId/student-profile` — student group-scoped profile → `{ "studentAccountId", "groupId", "lives", "currency", ... }`; see [docs/api.md](./docs/api.md)
- `POST /api/drive` — lecturer session; `multipart/form-data` fields `json` (string) and `banner` (file for `post`); see [docs/api.md](./docs/api.md)
- `POST /api/stages` — stage CRUD (method: post/modify/remove/retrieve); see [docs/api.md](./docs/api.md)
- `POST /api/activities` — activity CRUD (method: post/modify/remove/retrieve); see [docs/api.md](./docs/api.md)
- `GET /api/groups/:groupId/activities/:activityId/completions` — lecturer: list student account IDs with activity completed
- `PATCH /api/groups/:groupId/activities/:activityId/completions` — lecturer: bulk set activity completions (transactional currency adjust)
- `GET /api/groups/:groupId/students/:accountId/progress` — lecturer: progress tree with `isCompleted` flags
- `POST /api/groups/:groupId/students/:accountId/activities/:activityId/toggle` — lecturer: toggle single activity completion
- `POST /api/groups/:groupId/students/:accountId/badges/:badgeId/toggle` — lecturer: grant/revoke badge (revoke does not reduce `totalEarned`)
- `DELETE /api/groups/:groupId/badges/:badgeId` — lecturer: delete badge + revoke from students (`revokedFromStudents`)
- `GET /api/groups/:groupId/item-categories` — list shop item categories for a group
- `POST /api/groups/:groupId/item-categories` — lecturer: create category
- `PATCH /api/groups/:groupId/item-categories/:categoryId` — lecturer: update category
- `DELETE /api/groups/:groupId/item-categories/:categoryId` — lecturer: delete category (items become uncategorized)
- `GET /api/groups/:groupId/lives-config` — lives system configuration for the group (any authenticated user)
- `PATCH /api/groups/:groupId/lives-config` — lecturer: update lives system configuration (enabled, label, shop toggle)
- `DELETE /api/groups/:groupId/ranks/:rankId` — lecturer: delete rank; affected students get `rankId = null`
- `GET /api/auth/saml/status` — SAML configuration checklist
- `GET /api/auth/saml/metadata` — SP metadata XML (PIONIER.id / IdP)
- `GET /api/auth/saml/organizations` — institution picker list
- `GET /api/auth/saml/login?organizationId=` — start SAML SSO (`302` to selected IdP)
- `POST /api/auth/saml/acs` — SAML Assertion Consumer Service (establishes `maq_session`)
- `GET /api/auth/saml/logout` — institutional SSO sign-out
- `GET /api/auth/saml/me` — session JWT from cookie (smoke)
- `GET /api/admin/manageable-organizations` — org picker for account management UI (super or org administrator)
- `GET /api/admin/organizations/:organizationId/accounts` — list accounts in an organization (super or org administrator)
- `DELETE /api/admin/organizations/:organizationId/accounts/:accountId` — org administrator or super: remove organization account (see [docs/api.md](./docs/api.md))
- Local IdP: [docs/saml-local-idp.md](./docs/saml-local-idp.md) (`npm run idp:up`, test users `student` / `lecturer`)

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
