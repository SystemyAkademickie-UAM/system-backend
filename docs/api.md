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

## Admin organizations (super role)

Manage institutional SAML configuration stored in **`auth.organizations`** and **`auth.idp_certificates`**. Requires **`super`** role on the caller's **`auth.accounts`** row.

| Endpoint | Method | Description |
| -------- | ------ | ----------- |
| `/api/admin/organizations` | `POST` | Create organization. Set `metadataUrl` to fetch IdP entity ID, SSO URLs, and signing cert from federation metadata; or pass `certificatePem` when metadata is unavailable. |
| `/api/admin/organizations` | `GET` | List organizations with cert summary. |
| `/api/admin/organizations/:id` | `GET` | Organization detail. |
| `/api/admin/organizations/:id` | `PATCH` | Update name, contact, SSO URLs, `isActive`. |
| `/api/admin/organizations/:id` | `DELETE` | Soft-delete (`is_active = false`). |
| `/api/admin/organizations/:id/sync-from-metadata` | `POST` | Re-fetch IdP metadata from stored `metadata_url` and rotate signing certificate. |
| `/api/admin/organizations/:id/certificates` | `POST` | Rotate IdP signing certificate (PEM body). |
| `/api/admin/organizations/:id/certificates/:certId` | `DELETE` | Revoke certificate. |
| `/api/admin/organizations/:organizationId/administrators` | `GET` | List organization administrators (`administrator` role). |
| `/api/admin/organizations/:organizationId/administrators` | `POST` | Grant `administrator` role by user email (user must exist after SAML login). Body: `{ "email": "..." }`. |
| `/api/admin/organizations/:organizationId/administrators/:accountId` | `DELETE` | Revoke organization administrator role. |

**Bootstrap super admin:** set `SUPERADMIN_BOOTSTRAP_EMAIL` in `.env`. On first startup (or first SAML login with that email), when no `super` account exists, the API inserts one row in `auth.accounts`. Optional `SUPERADMIN_BOOTSTRAP_ORGANIZATION_ID` (default: first active organization).

Register organizations via admin API (no migration seed). Example: UAM — `metadataUrl` = `https://sso.amu.edu.pl/simplesaml/saml2/idp/metadata.php`. Local dev IdP — see [saml-local-idp.md](./saml-local-idp.md).

---

## Login (opaque API bearer issuance)

Issues a **plaintext** opaque bearer token. Clients send it back as the **`maq_auth`** HTTP-only cookie (browsers, automatic) **or** an **`Authorization: Bearer <token>`** header (non-browser API clients). The token is **never** read from the URL query string. The server persists only **`hex(HMAC-SHA256(API_TOKEN_HMAC_SECRET, plaintext))`** in Postgres **`autoryzacja.tokens.token_hmac`** plus **`user_id`**, **`browser_uuid`** (**PostgreSQL `uuid`** — clients MUST send an RFC 4122 UUID in **`X-Browser-ID`**), **`created_at`**, **`expired_at`** — recovering the plaintext from the database digest is intentionally infeasible without brute-forcing candidate tokens offline.

**Prerequisite (legacy exchange path):** authenticate via **SAML** so the browser holds HTTP-only **`saml_session`**, then call this endpoint to mint **`maq_auth`**. When ACS receives a valid **`browserId`** in RelayState, it mints **`maq_auth`** directly and the SPA can skip this call.

**Endpoint:** `POST /api/login`

**Headers:**

| Header | Description |
| ------ | ----------- |
| `X-Browser-ID` | Required RFC 4122 UUID. Binds issuance (and downstream **strong** checks) to `autoryzacja.tokens.browser_uuid`. |

**Request body**

Optional JSON is **reserved for future email/password provisioning** — omit the body entirely for the SAML-exchange flow today.

**Response:** `200 OK` with JSON body:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `auth` | string | One-time-visible opaque token (transport over **HTTPS only** outside local dev). |

**Errors:**

| Situation | HTTP | Notes |
| --------- | ---: | ----- |
| Missing / invalid `X-Browser-ID` (non-UUID) | `400` | Validation error envelope. |
| Missing / invalid SSO cookie | `401` | JSON body includes `error` codes `SAML_SESSION_REQUIRED` / `SAML_SESSION_INVALID`. |

Rotate previous rows for `(user_id, browser_uuid)` on each issuance (single active bearer per browser install).

Configure **`API_TOKEN_HMAC_SECRET`** (≥ 32 ASCII characters in **`NODE_ENV=production`**), **`API_TOKEN_IDLE_TIMEOUT_SECONDS`** (sliding idle, default 24 min), and **`API_TOKEN_ABSOLUTE_MAX_SECONDS`** (absolute cap, default 8 h).

**Session lifetime:** `maq_auth` and `saml_session` are **session cookies** (no `Max-Age`) — dropped on browser close. Server-side `expired_at` is the source of truth: a sliding idle window is refreshed on each authenticated request, never past the absolute cap measured from `created_at`. After idle expiry or the cap, the token is rejected and the user must re-authenticate.

**Rate limiting:** `POST /api/login`, `POST /api/login/active-role`, and `GET /api/auth/saml/login` are throttled per client IP (`@nestjs/throttler`); exceeding the limit returns `429 Too Many Requests`.

---

## Login session (API token cookie)

Browser clients that already hold **`maq_auth`** (e.g. after SAML ACS mint with RelayState browser id) can verify the session without a live SAML cookie.

**Endpoint:** `GET /api/login/me`

**Headers:**

| Header | Description |
| ------ | ----------- |
| `X-Browser-ID` | Required RFC 4122 UUID bound to the token row. |

**Response:** `200 OK` with JSON body (same shape as **`GET /api/auth/saml/me`**):

| Field | Type | Description |
| ----- | ---- | ----------- |
| `authenticated` | boolean | Whether the token resolves to a user. |
| `user` | object | Present when authenticated; includes `email`, `displayName`, `role`, `availableRoles`, etc. |

The `user` object exposes role information:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `role` | string | **Active** role: the selected role from the `maq_active_role` cookie when valid, otherwise the highest-privilege role the user holds. |
| `availableRoles` | string[] | All distinct roles the user holds, ordered highest → lowest privilege (`super`, `administrator`, `lecturer`, `student`). |

When not authenticated, returns `{ "authenticated": false }` (still `200`).

Uses **strong** auth (`maq_auth` + matching `X-Browser-ID`) when the header is present; falls back to **soft** auth (`maq_auth` cookie only) so the SPA can restore UI session state when the browser id header is missing or mismatched.

---

## Active role selection

Lets a user with more than one role choose which role is active for the UI. The choice is persisted in the HTTP-only **`maq_active_role`** cookie and reflected by `GET /api/login/me` (`user.role`). Cleared on logout.

**Endpoint:** `POST /api/login/active-role`

**Headers:** `X-Browser-ID` (RFC 4122 UUID bound to the token row).

**Authorization:** **strong** token + browser binding when possible; **soft** fallback (`maq_auth` cookie only).

**Request body:**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `role` | string | Role to activate. Must be one of the user's `availableRoles`. |

**Response:** `200 OK` — same shape as `GET /api/login/me`, with `user.role` set to the selected role.

**Errors:**

| Status | When |
| ------ | ---- |
| `400 Bad Request` | The requested role is not assigned to the user. |
| `401 Unauthorized` | No valid session. |

---

## Logout (clear API auth cookies)

Clears HTTP-only **`maq_auth`**, **`maq_active_role`**, and SAML session cookies for this browser origin. Revokes the current `maq_auth` database row when present. Does **not** perform IdP single logout — use **`GET /api/auth/saml/logout`** for institutional SSO sign-out.

**Endpoint:** `POST /api/logout`

**Request body:** none.

**Response:** `200 OK` with JSON body:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `success` | boolean | Always `true` when cookies were cleared. |

---

## Registration wizard (`/login` UI)

After SAML, first-time users complete nickname, avatar, and EULA in the SPA before accessing `/groups`. All steps require **`maq_auth`** (from ACS mint or **`POST /api/login`**) and **`X-Browser-ID`** unless noted.

**Endpoint:** `GET /api/login/registration-status`

**Headers:** `X-Browser-ID` (RFC 4122 UUID).

**Authorization:** **strong** token + browser binding when possible; **soft** fallback (`maq_auth` cookie only).

**Response:** `200 OK`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `userId` | integer | `auth.users.id`. |
| `email` | string | User email from SAML provisioning. |
| `nickname` | string | Display nickname (empty until profile step). |
| `avatarId` | integer | Selected avatar id. |
| `registrationCompleted` | boolean | Profile step done. |
| `eulaAccepted` | boolean | EULA accepted. |

**Endpoint:** `POST /api/login/profile`

**Request body:** `{ "nickname": string, "avatarId": integer }`

**Authorization:** **strong** only.

**Endpoint:** `POST /api/login/accept-eula`

**Request body:** `{}` (optional)

**Authorization:** **strong** only.

---

## User profile (authenticated)

**Endpoint:** `GET /api/profile`

**Authorization:** **soft** (`maq_auth` cookie, `Authorization: Bearer` header, or body `auth`). No `X-Browser-ID` required.

Returns the current user's profile row (nickname, avatar, registration flags, etc.).

**Endpoint:** `PATCH /api/profile/settings`

Updates nickname and/or avatar for the logged-in user.

---

## Activity completions (lecturer)

Bulk read/write of which students completed a group activity (for assign-activity modal).

**Endpoint:** `GET /api/groups/:groupId/activities/:activityId/completions`

**Authorization:** lecturer + soft auth. Activity must belong to the group (via stage join). `404` if group/activity missing or activity not in group.

**Response:** `200 OK`

```json
{ "activityId": 42, "completedAccountIds": [101, 105, 112] }
```

**Endpoint:** `PATCH /api/groups/:groupId/activities/:activityId/completions`

**Body:** `{ "accountIds": [101, 105, 112] }` — target set of enrolled students with activity **completed**. Idempotent.

**Response:** `200 OK`

```json
{
  "activityId": 42,
  "granted": 2,
  "revoked": 1,
  "completedAccountIds": [101, 105, 112]
}
```

Adjusts `gamification.student_stats.currency` and `totalEarned` like `POST .../activities/:activityId/toggle`. All account IDs must be enrolled in the group.

---

## CSV Reports (lecturer)

Generates and downloads CSV reports containing student progress matrices (activity completions).
Responses have `Content-Type: text/csv` and a `Content-Disposition` attachment header. CSV separator is `;`.

**Authorization:** lecturer + soft auth. Caller must own the group.

**Endpoint:** `GET /api/groups/:groupId/reports/group`
Downloads a report for the entire group. Rows = all students, Columns = all stage/activity pairs.

**Endpoint:** `GET /api/groups/:groupId/reports/stage/:stageId`
Downloads a report restricted to a single stage. Rows = all students, Columns = activities from that stage.

**Endpoint:** `GET /api/groups/:groupId/reports/student/:accountId`
Downloads a flat report for a single student. Columns: `Student;Stage;Activity;Completed`.

---

## User groups (student & lecturer)

Retrieves groups the authenticated user belongs to: student enrollments and lecturer-owned groups.

**Endpoint:** `GET /api/groups`

**Headers:**

| Header | Description |
| ------ | ----------- |
| `X-Browser-ID` | Required UUID binding for strong session verification. |

**Query parameters:**

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `auth` | string (optional) | Plaintext bearer token (alternative to `maq_auth` cookie). |

**Authorization:** **strong** token + browser binding.

**Unauthenticated / invalid session:** returns `{ "statusCode": 200, "groups": [] }` — same shape as an authenticated user with zero groups. Check auth separately before treating an empty list as “no memberships”.

**Response:** `200 OK` with JSON body:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `statusCode` | integer | Always `200`. |
| `groups` | array | Array of `UserGroupListItem` objects. |

**UserGroupListItem object:**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `id` | integer | Public group ID (includes `GROUP_RESPONSE_GROUP_ID_OFFSET`). |
| `groupName` | string | Group display name (`education.groups.name`). |
| `subjectName` | string | Currently mirrors `groupName` until subject is stored separately. |
| `bannerId` | string \| null | Group banner reference (`education.groups.image_ref`). |
| `lecturers` | string | Lecturer full name; empty string when unknown. |
| `description` | string \| null | Group description. |
| `shopOpen` | boolean | Indicates whether the group's shop is currently open. |

**Example**

```http
GET /api/groups HTTP/1.1
Host: 127.0.0.1:8080
X-Browser-ID: <BrowserUUID>
Cookie: maq_auth=<token>
```

```json
{
  "statusCode": 200,
  "groups": [
    {
      "id": 100001,
      "groupName": "Grupa A",
      "subjectName": "Grupa A",
      "bannerId": "banner-uuid",
      "lecturers": "Jan Kowalski",
      "description": "Opis grupy"
    }
  ]
}
```

---

## Groups (lecturer)

Requires **PostgreSQL** and matching TypeORM entities (see `.env.example`: `DATABASE_*`, optional `TYPEORM_SYNC=true` for local schema sync).

**Endpoint:** `POST /api/groups/new`

**Headers:**

| Header | Description |
| ------ | ----------- |
| `X-Browser-ID` | UUID; must match `autoryzacja.tokens.browser_uuid` for this bearer. |

**Request body (JSON):**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `auth` | string | Plaintext bearer; server matches `hex(HMAC-SHA256(secret, auth))` against `autoryzacja.tokens.token_hmac`. |
| `group.name` | string | Group display name (`edukacja.grupy.nazwa`). |
| `group.description` | string (optional) | Maps to `edukacja.grupy.opis`. |
| `group.currency` | string (optional) | Maps to `edukacja.grupy.waluta`. |
| `group.currencyIcon` | string (optional; numeric JSON is accepted—coerced to string) | Maps to `edukacja.grupy.ikona_waluty`. |
| `group.life` | integer (optional, ≥ 0) | Maps to `edukacja.grupy.zycie`; numeric strings are parsed where sent as strings. |
| `group.lifeIcon` | string (optional; numeric JSON accepted—coerced) | Maps to `edukacja.grupy.ikona_zycia`. |
| `group.bannerRef` | string (optional) | Maps to `edukacja.grupy.obrazek_ref`. |
| `group.entryCode` | string (optional) | Maps to `edukacja.grupy.kod_wstepu`. |

**Errors:** JSON **`group: 0`** means creation failed—check Nest logs (`GroupsService`) for the Postgres **`detail`** (FK/type/null violations).

**Authorization:** **strong** check — plaintext `auth` must map to a non-expired stored HMAC row, and `X-Browser-ID` must match `browser_uuid`. Then **`autoryzacja.konta`** must contain **`rola = lecturer`** for **`id_uzytkownika`** matching the token user. New **`edukacja.grupy`** rows set **`id_konta_prowadzacego`** to that lecturer row's **`autoryzacja.konta.id`**. Other endpoints can reuse **soft** token-only resolution via `resolveSubjectSoft` where browser binding is not required.

**Response:** `200 OK` with JSON body:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `statusCode` | integer | Example contract uses `200` on success. |
| `group` | integer | Success: **`edukacja.grupy.id` + 100 000** (see constant `GROUP_RESPONSE_GROUP_ID_OFFSET`); `0` if creation failed; `1` if not authorized. |

**Note:** The offset keeps API `group` values distinct from reserved codes `0` and `1`. Use this value as **`groupId`** in paths such as **`POST /api/groups/:groupId/enroll`**.

**Example**

```http
POST /api/groups/new HTTP/1.1
Host: 127.0.0.1:8080
Content-Type: application/json
X-Browser-ID: <BrowserUUID>

{"auth":"<token>","group":{"name":"...","description":"...","currency":"Coin","currencyIcon":"21","life":3,"lifeIcon":"13","bannerRef":"<uuid>","entryCode":"<optional>"}}
```

```json
{ "statusCode": 200, "group": 100137 }
```

*(Example: database row id `137` → JSON `group` `100137` when offset is `100000`.)*

---

### Update shop status (lecturer)

**Endpoint:** `PATCH /api/groups/:groupId/shop-status`

**Headers:**

| Header | Description |
| ------ | ----------- |
| `X-Browser-ID` | UUID; must match `autoryzacja.tokens.browser_uuid` for this bearer. |

**Request body (JSON):**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `auth` | string (optional) | Plaintext bearer. |
| `shopOpen` | boolean | Set to `true` to open the shop, `false` to close it. |

**Authorization:** **strong** token + browser binding. Caller must have the **lecturer** role and must own the group. Missing or invalid auth yields `401 Unauthorized` or `403 Forbidden`.

**Response:** `200 OK` with JSON body:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `statusCode` | integer | Always `200` on success. |
| `group` | integer | Public group id. |
| `updated` | boolean | `true` if successful. |

---

## Group posts management (lecturer & student)

Manages announcements / posts in **`edukacja.posts`** for a given course group.

### Create post (lecturer)

**Endpoint:** `POST /api/groups/:id/post`

**Headers:**

| Header | Description |
| ------ | ----------- |
| `X-Browser-ID` | UUID; must match `autoryzacja.tokens.browser_uuid` for this bearer. |

**Request body (JSON):**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `auth` | string | Plaintext bearer (same HMAC rules as groups). |
| `title` | string | Title of the announcement (non-empty). |
| `content` | string | Body text of the announcement (non-empty). |

**Authorization:** **strong** token + browser binding. Caller must have **`autoryzacja.konta`** with **`rola = lecturer`** and must own the group (`edukacja.grupy.teacher_account_id`). Missing lecturer account, invalid token, browser mismatch, or ownership mismatch yields `{ "status": 200, "post": 1 }`.

**Response example:**
```json
{ "status": 200, "post": 15 }
```

---

### Get posts (lecturer & student)

**Endpoint:** `GET /api/groups/:id/post` (also aliased as `GET /api/groups/:id/posts`)

**Headers:**

| Header | Description |
| ------ | ----------- |
| `X-Browser-ID` | UUID; must match `autoryzacja.tokens.browser_uuid` for this bearer. |

**Query parameters:**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `auth` | string | Plaintext bearer (optional if passed via `maq_auth` cookie). |

**Authorization:** **strong** token + browser binding. Caller must either be the lecturer owning the group OR a student enrolled in the group (`grywalizacja.zapisy`). Unauthorized callers receive an empty posts array.

**Response example:**
```json
{
  "status": 200,
  "posts": [
    {
      "id": 15,
      "title": "Zmiana terminu zajęć",
      "content": "Zajęcia w czwartek zostają odwołane."
    }
  ]
}
```

---

## Group enrollment (student)

Inserts a row in **`gamification.enrollments`** linking the caller’s **student** account to the group. For invite-code joins, prefer **`GET /api/groups/:groupId/invite?code=`** (validates the code and enrolls in one step). Use **`POST /api/groups/:groupId/enroll`** when the student already has access (e.g. open enrollment) without a code.

**Endpoint:** `POST /api/groups/:groupId/enroll`

**Headers:**

| Header | Description |
| ------ | ----------- |
| `X-Browser-ID` | UUID; must match `auth.tokens.browser_uuid` for this bearer. |

**URL parameters:**

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `groupId` | integer (≥ 1) | Public group id from **`POST /api/groups/new`** (includes **`GROUP_RESPONSE_GROUP_ID_OFFSET`**). Values below the offset are accepted as raw DB ids for backwards compatibility. |

**Request body (JSON):**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `auth` | string (optional) | Plaintext bearer when not using the `maq_auth` cookie. |

**Authorization:** **strong** token + browser binding. Caller must have a **student** account. Missing student account, invalid token, or browser mismatch yields **`enrollmentId: -1`**.

**Behaviour:** Resolves the internal group id from the path. If the group row is missing, **`enrollmentId: -2`**. If the student is already enrolled, returns the existing enrollment id (idempotent). DB failures return **`enrollmentId: -3`**.

**Response:** `200 OK` with JSON body:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `statusCode` | integer | `200` on success. |
| `enrollmentId` | integer | New or existing **`gamification.enrollments.id`** when `> 0`; negative error codes: `-1` not authorized, `-2` group not found, `-3` DB error. |
| `groupId` | integer (optional) | Public group id on success. |

**Example**

```http
POST /api/groups/100137/enroll HTTP/1.1
Host: 127.0.0.1:8080
Content-Type: application/json
X-Browser-ID: <BrowserUUID>
Cookie: maq_auth=<token>
```

```json
{ "statusCode": 200, "enrollmentId": 42, "groupId": 100137 }
```

---

## Group enrollment codes (lecturer)

CRUD for **`education.enrollment_codes`** — group-scoped invite codes (1–10 characters) with optional expiration and usage limits. Auto-generated codes are 6-character uppercase hex unless the lecturer supplies a custom `code`.

**Authorization:** **soft** auth (`maq_auth` cookie, `Authorization: Bearer` header, or body `auth`) plus **lecturer** role; caller must own the group.

| Endpoint | Method | Description |
| -------- | ------ | ----------- |
| `/api/groups/:groupId/enrollment-codes` | `GET` | List codes for the group (newest first). |
| `/api/groups/:groupId/enrollment-codes/:codeId` | `GET` | Single code by id. |
| `/api/groups/:groupId/enrollment-codes` | `POST` | Create code (`201`). Body: optional `code`, `expiresAt` (ISO-8601 or `null`), `maxUses`, `auth`. |
| `/api/groups/:groupId/enrollment-codes/:codeId` | `PATCH` | Update `expiresAt`, `maxUses`, `isActive`. Body includes optional `auth`. |
| `/api/groups/:groupId/enrollment-codes/:codeId` | `DELETE` | Delete code (`204`). Auth via `maq_auth` cookie or `Authorization: Bearer` header. |

**Code object fields:** `id`, `groupId`, `code`, `expiresAt`, `maxUses`, `useCount`, `isActive`, `createdAt`, `updatedAt`.

**Legacy compatibility (prefer enrollment-codes CRUD in new clients):**

| Endpoint | Method | Behaviour |
| -------- | ------ | --------- |
| `GET /api/groups/:groupId/access-code` | `GET` | Returns the latest active code for the group (`code`, `groupId`; empty `code` on error). |
| `POST /api/groups/generate-code` | `POST` | Creates a new code via **`POST …/enrollment-codes`** internally. Body: `groupId`, optional `auth`. |

---

## Group invite validation (student)

Validates an enrollment code and enrolls the student. Lookup is scoped to **`groupId`** in the path.

**Endpoint:** `GET /api/groups/:groupId/invite`

**Query parameters:**

| Parameter | Type | Rules | Description |
| --------- | ---- | ----- | ----------- |
| `code` | string | 1–10 characters | Enrollment code for this group. |
| `auth` | string (optional) | Plaintext bearer | Auth token (can also be passed via `maq_auth` cookie). |

**Response:** `200 OK` — `enrollmentId > 0` success; negative values: `-1` unauthorized, `-2` group not found, `-4` invalid/expired/exhausted/inactive code.

On success, increments `useCount` when the code has `maxUses` set (unless the student was already enrolled).

---

## Group student profile (student)

Retrieves student statistics (lives, currency, icons) scoped to a specific group enrollment.

**Endpoint:** `GET /api/groups/:groupId/student-profile`

**Headers:**

| Header | Description |
| ------ | ----------- |
| `X-Browser-ID` | Required UUID binding for session verification. |

**URL parameters:**

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `groupId` | integer | Public group ID (includes `GROUP_RESPONSE_GROUP_ID_OFFSET`). |

**Authorization:** **strong** token + browser binding. Caller must be enrolled in the specified group.

**Response:** `200 OK` with JSON body:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `studentAccountId` | integer | Caller's student account ID. |
| `groupId` | integer | Public group ID requested. |
| `lives` | integer | Remaining lives in this group (`gamification.enrollments`). |
| `currency` | string | Currency balance in this group (`gamification.enrollments`). |
| `currencyIcon` | string | Group's currency icon (`education.groups`). |
| `livesIcon` | string | Group's life icon (`education.groups`). |
| `shopOpen` | boolean | Indicates whether the group's shop is currently open. |

**Example**

```http
GET /api/groups/100137/student-profile HTTP/1.1
Host: 127.0.0.1:8080
X-Browser-ID: <BrowserUUID>
Cookie: maq_auth=<token>
```

```json
{
  "studentAccountId": 42,
  "groupId": 100137,
  "lives": 3,
  "currency": "100",
  "currencyIcon": "coin",
  "livesIcon": "heart",
  "shopOpen": true
}
```

---

## Backlog

Retrieve activity and event logs for a specific group.

### Get Student Backlog (Student)

**Endpoint:** `GET /api/groups/:groupId/backlog/me`

Retrieves the recent backlog history for the currently logged-in student in a given group.

**Query Parameters:**
| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `auth` | string (optional) | Access token (can also be passed via `maq_auth` cookie). |
| `take` | integer (optional) | Number of items to retrieve (pagination limit, default 50). |
| `skip` | integer (optional) | Number of items to skip (pagination offset, default 0). |

**Headers:**
| Header | Description |
| ------ | ----------- |
| `X-Browser-ID` | Browser binding ID for the strong session. |

**Response:** `200 OK` with JSON array of backlog items.

```json
[
  {
    "id": 12,
    "type": "SHOP_PURCHASE",
    "date": "2026-06-08T10:00:00.000Z",
    "value": "health_potion",
    "accountId": 42
  }
]
```

### Get Group Backlog (Lecturer / Admin)

**Endpoint:** `GET /api/groups/:groupId/backlog`

Retrieves the recent backlog history of all members in a given group.
Requires `SUPER` role or ownership of the group (`teacherAccountId`).

**Query Parameters:**
| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `auth` | string (optional) | Access token (can also be passed via `maq_auth` cookie). |
| `take` | integer (optional) | Number of items to retrieve (pagination limit, default 50). |
| `skip` | integer (optional) | Number of items to skip (pagination offset, default 0). |

**Headers:**
| Header | Description |
| ------ | ----------- |
| `X-Browser-ID` | Browser binding ID for the strong session. |

**Response:** `200 OK` with JSON array of backlog items.

---

## Stages (lecturer)

Manage stages within groups. Each stage belongs to a group and contains activities.

**Endpoint:** `POST /api/stages`

**Headers:**

| Header | Description |
| ------ | ----------- |
| `X-Browser-ID` | Required for `post` (strong auth); optional for `modify`/`remove`/`retrieve` (soft auth). |

**Request body (JSON):**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `auth` | string (optional) | Plaintext bearer token (can also be passed via `maq_auth` cookie). |
| `method` | string | One of: `post`, `modify`, `remove`, `retrieve`. |
| `stageId` | integer (optional) | Stage primary key (`education.stages.id`). Required for `modify`/`remove`. |
| `groupId` | integer (optional) | Public group ID (includes `GROUP_RESPONSE_GROUP_ID_OFFSET = 100000`). Required for `post`. |
| `name` | string (optional) | Stage name. Required for `post`. |

**Authorization:**
- `post`: **strong** auth (token + browser binding) + lecturer role.
- `modify`/`remove`: **soft** auth (token only) + lecturer role.
- `retrieve`: **soft** auth (any authenticated user).

**Response:** `200 OK` with JSON body:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `statusCode` | integer | `200` on success; `403` if not authorized; `400` if request JSON or field values are invalid. |
| `method` | string | Echoes the requested method (or `post` when `method` is missing/invalid). |
| `stage` | integer | For `post`/`modify`: stage DB id (positive); for `remove`: the removed id; for `retrieve`: count of stages returned. Error codes (negative): `-1` = creation failed, `-2` = not authorized, `-3` = not found, `-4` = invalid request. |
| `stages` | array (optional) | For `retrieve`: array of `{ id, groupId, name }` — `id` is DB id; `groupId` is public (with offset). |

All responses use this flat JSON shape only (no Nest `message` / `error` fields).

**Examples**

Invalid request (bad `stageId` type):
```http
POST /api/stages HTTP/1.1
Content-Type: application/json

{"method":"modify","stageId":-1}
```

```json
{ "statusCode": 400, "method": "modify", "stage": -4 }
```

Create a stage:
```http
POST /api/stages HTTP/1.1
Content-Type: application/json
X-Browser-ID: <BrowserUUID>

{"auth":"<token>","method":"post","groupId":100001,"name":"Week 1"}
```

```json
{ "statusCode": 200, "method": "post", "stage": 1 }
```

Retrieve stages for a group:
```http
POST /api/stages HTTP/1.1
Content-Type: application/json

{"auth":"<token>","method":"retrieve","groupId":100001}
```

```json
{
  "statusCode": 200,
  "method": "retrieve",
  "stage": 2,
  "stages": [
    { "id": 1, "groupId": 100001, "name": "Week 1" },
    { "id": 2, "groupId": 100001, "name": "Week 2" }
  ]
}
```

---

## Activities (lecturer)

Manage activities within stages. Each activity belongs to a stage and has currency rewards.

**Endpoint:** `POST /api/activities`

**Headers:**

| Header | Description |
| ------ | ----------- |
| `X-Browser-ID` | Required for `post` (strong auth); optional for `modify`/`remove`/`retrieve` (soft auth). |

**Request body (JSON):**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `auth` | string (optional) | Plaintext bearer token (can also be passed via `maq_auth` cookie). |
| `method` | string | One of: `post`, `modify`, `remove`, `retrieve`. |
| `activityId` | integer (optional) | Activity primary key (`education.activities.id`). Required for `modify`/`remove`. |
| `stageId` | integer (optional) | Stage primary key (`education.stages.id`). Required for `post`. |
| `name` | string (optional) | Activity name. Required for `post`. |
| `currency` | integer (optional) | Currency reward (≥ 0). Required for `post`. |
| `educationalDescription` | string (optional) | Educational description text. |
| `storyDescription` | string (optional) | Story/narrative description text. |

**Authorization:**
- `post`: **strong** auth (token + browser binding) + lecturer role.
- `modify`/`remove`: **soft** auth (token only) + lecturer role.
- `retrieve`: **soft** auth (any authenticated user).

**Response:** `200 OK` with JSON body:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `statusCode` | integer | `200` on success; `403` if not authorized; `400` if request JSON or field values are invalid. |
| `method` | string | Echoes the requested method (or `post` when `method` is missing/invalid). |
| `activity` | integer | For `post`/`modify`: activity DB id (positive); for `remove`: the removed id; for `retrieve`: count of activities returned. Error codes (negative): `-1` = creation failed, `-2` = not authorized, `-3` = not found, `-4` = stage not found, `-5` = invalid request. |
| `activities` | array (optional) | For `retrieve`: array of `{ id, stageId, name, currency, educationalDescription, storyDescription }` (DB ids). |

All responses use this flat JSON shape only (no Nest `message` / `error` fields).

**Examples**

Invalid request (bad `stageId` type):
```http
POST /api/activities HTTP/1.1
Content-Type: application/json

{"method":"post","stageId":"abc"}
```

```json
{ "statusCode": 400, "method": "post", "activity": -5 }
```

Create an activity:
```http
POST /api/activities HTTP/1.1
Content-Type: application/json
X-Browser-ID: <BrowserUUID>

{"auth":"<token>","method":"post","stageId":1,"name":"Quiz 1","currency":100,"educationalDescription":"Test your knowledge","storyDescription":"The hero faces a challenge"}
```

```json
{ "statusCode": 200, "method": "post", "activity": 1 }
```

Retrieve activities for a stage:
```http
POST /api/activities HTTP/1.1
Content-Type: application/json

{"auth":"<token>","method":"retrieve","stageId":1}
```

```json
{
  "statusCode": 200,
  "method": "retrieve",
  "activity": 2,
  "activities": [
    { "id": 1, "stageId": 1, "name": "Quiz 1", "currency": 100, "educationalDescription": "Test your knowledge", "storyDescription": "The hero faces a challenge" },
    { "id": 2, "stageId": 1, "name": "Assignment 1", "currency": 50, "educationalDescription": "Practice problems", "storyDescription": "Training montage" }
  ]
}
```

---

## Badges (lecturer)

Creates a badge definition in `gamification.badges` for a course group.

**Endpoint:** `POST /api/groups/:groupId/badges`

**Auth:** **Soft** token resolution — `maq_auth` cookie **or** body `auth`; **`X-Browser-ID` is not required**. Caller must have the **lecturer** role.

**Path parameter:**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `groupId` | integer | Public group id (includes **`GROUP_RESPONSE_GROUP_ID_OFFSET`**). |

**Request body (JSON):**

| Field | Type | Rules | Description |
| ----- | ---- | ----- | ----------- |
| `auth` | string (optional) | — | Opaque bearer when not using cookie. |
| `name` | string | required | Badge name. |
| `icon` | string | required | Icon (emoji or id). |
| `educationalDescription` | string | required | Educational text. |
| `storyDescription` | string (optional) | — | Narrative text. |
| `rewardAmount` | integer (optional) | ≥ 0 | Reward points (default `0`). |

**Response:** `201 Created` — persisted badge entity (camelCase fields).

**Errors:** `403 Forbidden` when token is missing/invalid or caller is not a lecturer; `404 Not Found` when the group does not exist.

**Example**

```http
POST /api/groups/100001/badges HTTP/1.1
Host: 127.0.0.1:8080
Content-Type: application/json
Cookie: maq_auth=…

{
  "name": "Odznaka Pierwszych Kroków",
  "icon": "🏅",
  "educationalDescription": "Przyznawana za ukończenie pierwszego etapu kursu.",
  "storyDescription": "Bohater stawia pierwsze kroki w Akademii Magii...",
  "rewardAmount": 50
}
```

**Endpoint:** `DELETE /api/groups/:groupId/badges/:badgeId`

Removes the badge, revokes it from all students (currency only — `totalEarned` unchanged), and returns `{ "deleted": true, "revokedFromStudents": N }`.

**Endpoint:** `POST /api/groups/:groupId/students/:accountId/badges/:badgeId/toggle`

Grant: `currency` and `totalEarned` increase by `rewardAmount`. Revoke: `currency` decreases (min 0); **`totalEarned` unchanged**. Response: `{ "isEarned": boolean }`.

---

## Shop item categories (lecturer)

Group-scoped categories for shop catalog items (`gamification.item_categories`). Items reference a category via `gamification.items.category_id` (nullable). Item images use `gamification.items.image_ref` — a drive UUID from `POST /api/drive`, served at `GET /api/drive/:driveRef` (same as group `imageRef` / `bannerId`).

**Endpoint:** `GET /api/groups/:groupId/item-categories`

**Auth:** **Soft** token resolution — `maq_auth` cookie **or** `Authorization: Bearer` header; **`X-Browser-ID` is not required**. Caller must be the **group owner (lecturer)** or an **enrolled student** in that group.

**Response:** `200 OK` — array of categories ordered by `displayOrder`, then `name` (camelCase fields).

**Endpoint:** `POST /api/groups/:groupId/item-categories`

**Auth:** Soft token + **lecturer** role; caller must **own** the group (`education.groups.teacher_account_id`).

**Request body (JSON):**

| Field | Type | Rules | Description |
| ----- | ---- | ----- | ----------- |
| `auth` | string (optional) | — | Opaque bearer when not using cookie. |
| `name` | string | required | Category name (unique per group). |
| `description` | string (optional) | — | Optional description. |
| `displayOrder` | integer (optional) | — | Sort order in shop UI. |

**Response:** `201 Created` — persisted category entity.

**Errors:** `403 Forbidden` (not owner / not enrolled); `404 Not Found` (group); `409 Conflict` (duplicate name in group).

**Endpoint:** `PATCH /api/groups/:groupId/item-categories/:categoryId`

**Auth:** Soft token + **lecturer** who **owns** the group.

**Request body:** optional `auth`, `name`, `description`, `displayOrder`.

**Response:** `200 OK` — updated category.

**Endpoint:** `DELETE /api/groups/:groupId/item-categories/:categoryId`

**Auth:** Soft token + **lecturer** who **owns** the group.

Deletes the category. Items in the category get `category_id = NULL`. Response: `{ "deleted": true }`.

---

## Ranks (lecturer)

Creates a rank definition in `gamification.ranks` for a course group.

**Endpoint:** `POST /api/groups/:groupId/ranks`

**Auth:** **Soft** token resolution — `maq_auth` cookie **or** body `auth`; **`X-Browser-ID` is not required**. Caller must have the **lecturer** role.

**Path parameter:**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `groupId` | integer | Public group id (includes **`GROUP_RESPONSE_GROUP_ID_OFFSET`**). |

**Request body (JSON):**

| Field | Type | Rules | Description |
| ----- | ---- | ----- | ----------- |
| `auth` | string (optional) | — | Opaque bearer when not using cookie. |
| `name` | string | required | Rank name. |
| `icon` | string | required | Icon (emoji or id). |
| `requiredPoints` | integer | required, ≥ 0 | Points threshold. |
| `storyDescription` | string (optional) | — | Narrative text. |
| `storeDiscount` | integer (optional) | ≥ 0 | Shop discount (default `0`). |
| `uniqueStoreItems` | string[] (optional) | — | Exclusive shop item names. |

**Response:** `201 Created` — persisted rank entity (camelCase fields).

**Errors:** `403 Forbidden` when token is missing/invalid or caller is not a lecturer; `404 Not Found` when the group does not exist.

**Example**

```http
POST /api/groups/100001/ranks HTTP/1.1
Host: 127.0.0.1:8080
Content-Type: application/json
Cookie: maq_auth=…

{
  "name": "Adept",
  "icon": "⭐",
  "requiredPoints": 100,
  "storyDescription": "Adept to ktoś, kto opanował podstawy magii arkanowej.",
  "storeDiscount": 5,
  "uniqueStoreItems": ["Zwój Mądrości", "Eliksir Skupienia"]
}
```

**Endpoint:** `DELETE /api/groups/:groupId/ranks/:rankId`

Deletes the rank. Students who had this rank get `rank_id = NULL` (“Brak”) before removal. Response: `{ "deleted": true }`.

---

## CSV Reports (lecturer)

Downloads CSV files tracking student activity completions. The endpoints return `text/csv; charset=utf-8` with a UTF-8 BOM (`\uFEFF`) to ensure Excel on Windows opens them correctly, and uses semicolons (`;`) for the Polish locale.

**Auth:** **Soft** token resolution — `maq_auth` cookie **or** `Authorization: Bearer` header; **`X-Browser-ID` is not required**. Caller must be a **lecturer** who **owns** the group.

**Errors:**
- `403 Forbidden`: Token missing/invalid, caller is not a lecturer, or caller is not the group owner.
- `404 Not Found`: The specified stage or student does not exist within the group.

### Group Report
**Endpoint:** `GET /api/groups/:groupId/reports/group`

Downloads a matrix report for all students across all stages/activities.

### Stage Report
**Endpoint:** `GET /api/groups/:groupId/reports/stage/:stageId`

Downloads a matrix report for all students, filtered to a single stage.

### Student Report
**Endpoint:** `GET /api/groups/:groupId/reports/student/:accountId`

Downloads a flat report for a single student.

---

## Drive (file storage)

### Serve stored object (public)

**Endpoint:** `GET /api/drive/:driveRef`

**Path parameter:**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `driveRef` | string (UUID v4) | Object identifier returned by `POST /api/drive`. |

**Query parameters (optional):**

| Parameter | Type | Default | Description |
| --------- | ---- | ------- | ----------- |
| `organizationId` | integer | `DRIVE_DEFAULT_ORGANIZATION_ID` | Organization storage segment. |

**Authorization:** None required — banner images are publicly accessible (UUID acts as an opaque token).

**Response:** `200 OK`

| Header | Value |
| ------ | ----- |
| `Content-Type` | Detected from file magic bytes: `image/png`, `image/jpeg`, `image/gif`, `image/webp`, or `application/octet-stream`. |
| `Content-Length` | File size in bytes. |
| `Cache-Control` | `public, max-age=86400` |

Body: raw image bytes.

**Errors:**

| Situation | HTTP | Description |
| --------- | ---: | ----------- |
| Invalid UUID format | `400` | `driveRef` does not match RFC 4122 UUID pattern. |
| File not found on disk | `404` | No object stored for this UUID and organization. |

**Example**

```http
GET /api/drive/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
Host: 127.0.0.1:8080
```

Response: `200 OK` with `Content-Type: image/png` and raw PNG bytes.

### Upload / remove object (lecturer)

**Endpoint:** `POST /api/drive`

**Headers:**

| Header | Description |
| ------ | ----------- |
| `X-Browser-ID` | Same browser binding as for `/api/groups/new` and `/api/groups/:groupId/enroll`. |

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
| `statusCode` | integer | `200` on success; `403` in JSON when the session is not a lecturer session (browser binding / token / role). |
| `method` | string | Echoes `post` or `remove`. |
| `driveRef` | string | Stored object id (UUID for `post`). |
| `size` | integer | Byte length on disk after `post`; `0` for `remove`. |

---

## SAML 2.0 (per-organization IdP)

These routes implement a **Service Provider (SP)** using `@node-saml/passport-saml`. **IdP settings** (SSO URL, logout URL, signing certificate) are loaded from **`auth.organizations`** + **`auth.idp_certificates`** after the user picks an institution.

### Environment (SP only)

| Variable | Purpose |
| -------- | ------- |
| `SAML_SP_ENTITY_ID` | SP entity ID (metadata URL). |
| `SAML_ACS_URL` | Assertion Consumer Service URL (**POST**). |
| `SAML_SP_CERT_PATH` / `SAML_SP_PRIVATE_KEY_PATH` | SP certificate and private key (PEM). |
| `SAML_JWT_SECRET` | Session JWT secret. |
| `SAML_LOGIN_SUCCESS_URL` | Redirect after successful ACS. |

Local dev IdP: see [docs/saml-local-idp.md](./saml-local-idp.md). UAM production metadata: [sso.amu.edu.pl](https://sso.amu.edu.pl/simplesaml/saml2/idp/metadata.php).

### Endpoints

**GET `/api/auth/saml/status`** — SP configured flag + `localIdpEntryPoint`.

**GET `/api/auth/saml/organizations`** — `{ "organizations": [{ "id", "name" }] }` for SAML-ready active orgs.

**GET `/api/auth/saml/metadata`** — SP metadata XML (`200`, `application/xml`).

**GET `/api/auth/saml/login?organizationId=<id>&browserId=<uuid>`** — requires organization picker choice; optional **`browserId`** (RFC 4122 UUID) is embedded in **RelayState** so ACS can mint **`maq_auth`** bound to the same browser install as the SPA. Sets pending-org cookie (`SameSite=None; Secure` on HTTPS so it survives the cross-site IdP POST to ACS); **`302`** to org's IdP SSO URL.

**POST `/api/auth/saml/acs`** — ACS; provisions `auth.users` + `auth.accounts` for pending org. Resolves organization from **RelayState** (primary) or pending-org cookie (fallback). When RelayState carries a valid **`browserId`**, mints **`maq_auth`** (HTTP-only cookie) for that browser without requiring a separate **`POST /api/login`**. Redirects to **`SAML_LOGIN_SUCCESS_URL`** (prefer `{SPA origin}/login` for the registration wizard).

**GET `/api/auth/saml/me`** — session smoke check from cookie.

**GET `/api/auth/saml/logout`** — SAML SLO when org logout URL is configured.

### Local development (SPA + proxy)

Point **`SAML_ACS_URL`** at the **same origin** the browser uses for `/api` (e.g. `http://127.0.0.1:3000/api/auth/saml/acs` when Vite or nginx proxies `/api` to Nest on **8080**). Use **`127.0.0.1`** consistently (not a mix of `localhost` and `127.0.0.1`) so cookies and CORS align. The SPA pins **`X-Browser-ID`** before redirecting to SAML login; ACS must receive the same id via RelayState.

### CORS

The API enables **`Access-Control-Allow-Credentials`** so browsers may send cookies when `Origin` is allowlisted and the client uses credentials (see `CORS_ORIGIN`).
