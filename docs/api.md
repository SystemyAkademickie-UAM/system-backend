# HTTP API

Base URL (example): `http://127.0.0.1:8080`  
Global prefix: `/api`

## Health (smoke)

**Endpoint:** `GET /api/counter/health`

**Response:** `200 OK` with JSON body:

| Field | Type    | Description   |
| ----- | ------- | ------------- |
| `ok`  | boolean | Always `true` |

## Increment counter

**Endpoint:** `POST /api/counter/increment`

**Request body (JSON):**

| Field            | Type    | Rules       | Description                          |
| ---------------- | ------- | ----------- | ------------------------------------ |
| `currentCount`   | integer | integer ≥ 0 | Last count from the client’s state   |

**Response:** `201 Created` with JSON body:

| Field   | Type    | Description        |
| ------- | ------- | ------------------ |
| `count` | integer | `currentCount + 1` |

**Example**

```http
POST /api/counter/increment HTTP/1.1
Host: 127.0.0.1:8080
Content-Type: application/json

{"currentCount": 3}
```

```json
{ "count": 4 }
```

Validation errors return `400` with Nest’s default error shape.

Clients send the previous value; the response carries the incremented value.

---

## Login (opaque API bearer issuance)

Issues a **plaintext** bearer string for `{ "auth": "..." }` field used by `/api/groups/new` and `/api/drive`. The server persists only **`hex(HMAC-SHA256(API_TOKEN_HMAC_SECRET, plaintext))`** in Postgres (`auth_tokens.token_hmac`) plus `user_id`, `browser_uuid`, `created_at`, `expires_at` — recovering the plaintext from the database digest is intentionally infeasible without brute-forcing candidate tokens offline.

**Prerequisite:** authenticate via **SAML** so the browser holds HTTP-only **`maqSamlSession`** (see SAML section).

**Endpoint:** `POST /api/login`

**Headers:**

| Header | Description |
| ------ | ----------- |
| `X-Browser-ID` | Required. Binds issuance (and downstream **strong** checks) to `auth_tokens.browser_uuid`. |

**Request body**

Optional JSON is **reserved for future email/password provisioning** — omit the body entirely for the SAML-exchange flow today.

**Response:** `200 OK` with JSON body:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `auth` | string | One-time-visible opaque token (transport over **HTTPS only** outside local dev). |

**Errors:**

| Situation | HTTP | Notes |
| --------- | ---: | ----- |
| Missing `X-Browser-ID` | `400` | Validation error envelope. |
| Missing / invalid SSO cookie | `401` | JSON body includes `error` codes `SAML_SESSION_REQUIRED` / `SAML_SESSION_INVALID`. |

Rotate previous rows for `(user_id, browser_uuid)` on each issuance (single active bearer per browser install).

Configure **`API_TOKEN_HMAC_SECRET`** (≥ 32 ASCII characters in **`NODE_ENV=production`**) and optional **`API_TOKEN_TTL_SECONDS`**.

---

## Groups (lecturer)

Requires **PostgreSQL** and matching TypeORM entities (see `.env.example`: `DATABASE_*`, optional `TYPEORM_SYNC=true` for local schema sync).

**Endpoint:** `POST /api/groups/new`

**Headers:**

| Header | Description |
| ------ | ----------- |
| `X-Browser-ID` | Must match the `browser_uuid` stored with the auth token row. |

**Request body (JSON):**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `auth` | string | Plaintext bearer; server matches `hex(HMAC-SHA256(secret, auth))` against `auth_tokens.token_hmac`. |
| `group.name` | string | Group display name. |
| `group.description` | string | Description text. |
| `group.currency` | string | Custom currency label. |
| `group.currencyIcon` | integer | Icon reference id (≥ 0). |
| `group.life` | string | “Lives” label. |
| `group.lifeIcon` | integer | Icon reference id (≥ 0). |
| `group.bannerRef` | string (optional) | Drive / asset reference (e.g. UUID). |

**Authorization:** **strong** check — plaintext `auth` must map to a non-expired stored HMAC row, and `X-Browser-ID` must match `browser_uuid`. Then a separate **role** check: `user_roles` must contain role `lecturer` for that user. (Internally: `AuthTokenSessionService.resolveSubjectStrong` + `UserRolesService`; other endpoints can reuse **soft** token-only resolution via `resolveSubjectSoft` where browser binding is not required.)

**Response:** `200 OK` with JSON body:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `status` | integer | Example contract uses `200` on success. |
| `group` | integer | New row id in `groups`, or `0` if creation failed, or `1` if not authorized. |

**Example**

```http
POST /api/groups/new HTTP/1.1
Host: 127.0.0.1:8080
Content-Type: application/json
X-Browser-ID: <BrowserUUID>

{"auth":"<token>","group":{"name":"...","description":"...","currency":"...","currencyIcon":21,"life":"...","lifeIcon":13,"bannerRef":"<uuid>"}}
```

```json
{ "status": 200, "group": 538137 }
```

---

## Drive (lecturer, multipart)

**Endpoint:** `POST /api/drive`

**Headers:**

| Header | Description |
| ------ | ----------- |
| `X-Browser-ID` | Same browser binding as for `/api/groups/new`. |

**Request:** `Content-Type: multipart/form-data`

| Field | Type | Rules |
| ----- | ---- | ----- |
| `json` | string | Stringified JSON (see below). |
| `banner` | file | Required when `drive.method` is `post` (image bytes). |

**`json` string content**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `auth` | string | Auth token (same validation as groups). |
| `drive.method` | string | `post` (upload) or `remove` (delete). |
| `drive.driveRef` | string | Empty for `post`; object id / UUID for `remove`. |
| `drive.size` | number | Client-reported size (validated/logic TBD); responses use stored or `0`. |
| `drive.organizationId` | number (optional) | Path segment; defaults to `DRIVE_DEFAULT_ORGANIZATION_ID` from env. |

On **`post`**, the server writes the file to:

`<DRIVE_STORAGE_ROOT>/drive/<organizationId>/<uuid>`

using a new random UUID as the filename (and returns that value as `driveRef`).

**Response:** `200 OK` with JSON body:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `status` | integer | `200` on success; `403` in JSON when the session is not a lecturer session (browser binding / token / role). |
| `method` | string | Echoes `post` or `remove`. |
| `driveRef` | string | Stored object id (UUID for `post`). |
| `size` | integer | Byte length on disk after `post`; `0` for `remove`. |

---

## SAML 2.0 (PIONIER.id / institutional IdP)

These routes implement a **Service Provider (SP)** using `@node-saml/passport-saml`. Configure federation metadata exchange with your IdP (e.g. UAM) and PIONIER.id registration as required by your institution.

### Environment (required for SP to activate)

| Variable | Purpose |
| -------- | ------- |
| `SAML_SP_ENTITY_ID` | SP `entityID` — public URI, often your metadata URL. |
| `SAML_ACS_URL` | Full URL of the Assertion Consumer Service (must match deployed host). |
| `SAML_ENTRY_POINT` | IdP single sign-on URL (from IdP metadata). |
| `SAML_IDP_CERT` **or** `SAML_IDP_CERT_PATH` | IdP signing certificate (PEM). |
| `SAML_SP_PUBLIC_CERT` **or** `SAML_SP_PUBLIC_CERT_PATH` | SP public certificate (PEM). |
| `SAML_SP_PRIVATE_KEY` **or** `SAML_SP_PRIVATE_KEY_PATH` | SP private key (PEM). |
| `SAML_SESSION_JWT_SECRET` | Secret for signing the HTTP-only session JWT. **Required whenever SAML SP routes should activate** (including non-production). |
| `SAML_LOGIN_SUCCESS_REDIRECT_URL` | Optional. Browser redirect after successful ACS (default `http://127.0.0.1:3000/`). |
| `SAML_SESSION_JWT_EXPIRES_IN` | Optional. JWT lifetime and cookie `maxAge` (default `8h`). Same format as `jsonwebtoken` / `ms` (e.g. `8h`, `15m`, or seconds as a number string). |

If any required value is missing, **`/api/auth/saml/login`**, **`/api/auth/saml/metadata`**, and **`/api/auth/saml/acs`** respond with **`503`** and a JSON body with `error: "SAML_NOT_CONFIGURED"` (except **`/api/auth/saml/status`**, which always returns **`200`**).

**InResponseTo:** The SP validates SAML responses against the AuthnRequest ID (`validateInResponseTo: always`) using the default in-memory cache from `@node-saml/node-saml`. **Multiple API instances** behind a load balancer must use a **shared cache provider** (see node-saml `cacheProvider`) or logins may fail intermittently.

**Invalid PEM paths:** Missing files or unreadable `*_PATH` values are treated as “cert not configured” so `/status` and startup do not throw; the SP stays off until paths and files are valid.

### Endpoints

**GET `/api/auth/saml/status`**

Returns whether SAML is configured, plus a boolean checklist for operators.

The `requirements` object only means the related **environment variables are set**. **`configurationComplete`** and **`samlReady`** additionally require **PEM material to load** (see **`pemMaterialLoaded`**). If `requirements` are all `true` but `pemMaterialLoaded` entries are `false`, fix **file paths** (e.g. use absolute paths or correct bind mounts in Docker — relative paths like `./../secrets/` depend on the process working directory).

**GET `/api/auth/saml/metadata`**

Returns **`200`** with **`Content-Type: application/xml`** — SP metadata for IdPs and federation registration.

**GET `/api/auth/saml/login`**

Starts SAML **Web SSO** — responds with **`302`** to the IdP `entryPoint` when configured.

**POST `/api/auth/saml/acs`**

Assertion Consumer Service — accepts `SAMLResponse` (HTTP-POST). On success, sets an HTTP-only cookie `maqSamlSession` with a JWT and redirects to `SAML_LOGIN_SUCCESS_REDIRECT_URL`.

**GET `/api/auth/saml/me`**

Returns **`{ "authenticated": false }`** or **`{ "authenticated": true, "user": { "sub", "email?", "displayName?" } }`** from the cookie. Intended for **smoke / debugging** only — do not rely on it as the sole authorization gate for protected APIs.

### CORS

The API enables **`Access-Control-Allow-Credentials`** so browsers may send cookies when `Origin` is allowlisted and the client uses credentials (see `CORS_ORIGIN`).
