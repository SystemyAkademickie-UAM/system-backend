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

## Dev SAML bypass (non-production)

When **`SAML_BYPASS_ENABLED=true`** and **`NODE_ENV`** is not **`production`**, the API exposes shortcuts that mint the same HTTP-only **`maqSamlSession`** cookie as a successful SAML ACS, **without** contacting an IdP. They also upsert **`autoryzacja.uzytkownicy`** rows; lecturer flows ensure **`autoryzacja.konta`** with **`rola = lecturer`**. The organization key **`id_organizacji`** is **`SAML_BYPASS_ORGANIZATION_ID`** when that row exists in **`autoryzacja.organizacje`**; otherwise the smallest existing **`autoryzacja.organizacje.id`**, or a seeded organization named **`Dev organization (bypass seed)`** when the table is empty.

| Endpoint | Method | Behaviour |
| -------- | ------ | ----------- |
| `/api/auth/saml/bypass/student` | `GET` | Seed student persona, set cookie, **`302`** to **`SAML_LOGIN_SUCCESS_REDIRECT_URL`**. |
| `/api/auth/saml/bypass/lecturer` | `GET` | Seed lecturer persona + `autoryzacja.konta`, set cookie, **`302`** redirect. |
| `/api/auth/saml/bypass/session` | `POST` | Body **`{ "profile": "student" \| "lecturer" }`** — same seeding + cookie, **`200`** JSON **`{ "ok": true, "profile": "..." }`** (for same-origin `fetch` without navigation). |

If bypass is disabled or **`NODE_ENV=production`**, these routes return **`403`** with **`SAML_BYPASS_DISABLED`**.

**Database:** lecturer bypass inserts **`autoryzacja.konta`** only after resolving **`id_organizacji`** against **`autoryzacja.organizacje`** (preferred env id → first row → insert seed row if empty).

---

## Login (opaque API bearer issuance)

Issues a **plaintext** bearer string for `{ "auth": "..." }` field used by `/api/groups/new`, `/api/groups/enroll`, `/api/drive`, `/api/stages`, `/api/activities`, `/api/groups/:groupId/badges`, and `/api/groups/:groupId/ranks`. The server persists only **`hex(HMAC-SHA256(API_TOKEN_HMAC_SECRET, plaintext))`** in Postgres **`autoryzacja.tokens.token_hmac`** plus **`user_id`**, **`browser_uuid`** (**PostgreSQL `uuid`** — clients MUST send an RFC 4122 UUID in **`X-Browser-ID`**), **`created_at`**, **`expired_at`** — recovering the plaintext from the database digest is intentionally infeasible without brute-forcing candidate tokens offline.

**Prerequisite:** authenticate via **SAML** so the browser holds HTTP-only **`maqSamlSession`** (see SAML section).

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

Configure **`API_TOKEN_HMAC_SECRET`** (≥ 32 ASCII characters in **`NODE_ENV=production`**) and optional **`API_TOKEN_TTL_SECONDS`**.

---

## Logout (clear API auth cookies)

Clears HTTP-only **`maq_auth`** and SAML session cookies for this browser origin. Does **not** perform IdP single logout — use **`GET /api/auth/saml/logout`** for institutional SSO sign-out.

**Endpoint:** `POST /api/logout`

**Request body:** none.

**Response:** `200 OK` with JSON body:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `success` | boolean | Always `true` when cookies were cleared. |

---

## User groups (student & lecturer)

Retrieves a list of groups the authenticated user belongs to. For students, it returns groups they are enrolled in. For lecturers, it returns groups they own.

**Endpoint:** `GET /api/groups`

**Headers:**

| Header | Description |
| ------ | ----------- |
| `X-Browser-ID` | Required UUID binding for session verification. |

**Query parameters:**

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `auth` | string (optional) | Plaintext bearer token (can also be passed via `maq_auth` cookie). |

**Authorization:** **strong** token + browser binding.

**Response:** `200 OK` with JSON body:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `statusCode` | integer | Always `200`. |
| `groups` | array | Array of `UserGroupListItem` objects representing the user's groups. |

**UserGroupListItem object:**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `id` | integer | Public group ID (includes `GROUP_RESPONSE_GROUP_ID_OFFSET`). |
| `groupName` | string | Name of the group (`edukacja.grupy.nazwa`). |
| `subjectName` | string | Subject name (currently defaults to `''` for lecturers or is fetched from `edukacja.przedmioty`). |
| `lecturerName` | string | The full name of the group's lecturer. |

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
      "subjectName": "Programowanie Obiektowe",
      "lecturerName": "Jan Kowalski"
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

**Note:** The offset keeps API `group` values distinct from reserved codes `0` and `1`. Use this value as **`groupId`** when calling **`POST /api/groups/enroll`**.

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

Inserts a **`grywalizacja.zapisy`** row linking the caller’s **student** `autoryzacja.konta` id to **`edukacja.grupy.id`**. Invite-code acceptance and **`/api/groups/invite`** validation are implemented separately; call this endpoint **after** those succeed.

**Endpoint:** `POST /api/groups/enroll` (also supports legacy `:id/enroll`)

**Headers:**

| Header | Description |
| ------ | ----------- |
| `X-Browser-ID` | UUID; must match `autoryzacja.tokens.browser_uuid` for this bearer. |

**Request body (JSON):**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `auth` | string | Plaintext bearer (same HMAC rules as groups). |
| `groupId` | integer (≥ 1) | Prefer the **`group`** value from **`POST /api/groups/new`** (includes **`GROUP_RESPONSE_GROUP_ID_OFFSET`**). The server subtracts that offset to get **`edukacja.grupy.id`**. Values below the offset are still accepted as a raw primary key for backwards compatibility. Numeric strings are coerced where clients send strings. |

**Authorization:** **strong** token + browser binding. Caller must have **`autoryzacja.konta`** with **`rola = student`** for the token’s user. Missing student account, invalid token, or browser mismatch yields **`zapis: 1`**.

**Behaviour:** After resolving the database id from **`groupId`**, if **`edukacja.grupy`** has no matching row, response **`zapis: 0`**. If the student is already enrolled (same **`id_grupy`** + **`id_konta_studenta`**), returns the existing **`grywalizacja.zapisy.id`** (idempotent).

**Response:** `200 OK` with JSON body:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `statusCode` | integer | Example contract uses `200` on success. |
| `zapis` | integer | New or existing **`grywalizacja.zapisy.id`**, or **`0`** if the row could not be created, or **`1`** if not authorized as a student. |

**Example**

```http
POST /api/groups/enroll HTTP/1.1
Host: 127.0.0.1:8080
Content-Type: application/json
X-Browser-ID: <BrowserUUID>

{"auth":"<token>","groupId":100137}
```

```json
{ "statusCode": 200, "zapis": 42 }
```

---

## Group invite validation (student)

Validates an entry code and enrolls the student into the corresponding group. Matches FigJam architecture specs.

**Endpoint:** `GET /api/groups/invite`

**Headers:**

| Header | Description |
| ------ | ----------- |
| `X-Browser-ID` | Required UUID binding for session verification. |

**Query parameters:**

| Parameter | Type | Rules | Description |
| --------- | ---- | ----- | ----------- |
| `code` | string | Exactly 6 characters | The entry code generated by the lecturer. |
| `auth` | string (optional) | Plaintext bearer | Auth token (can also be passed via `maq_auth` cookie). |

**Authorization:** **strong** token + browser binding. Caller must have a valid student role.

**Response:** `200 OK` with JSON body:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `statusCode` | integer | Always `200`. |
| `code` | string | Echoes the requested entry code. |
| `group` | integer | `100000 + ID` on success; `0` if code not found; `1` if expired / unauthorized. |

**Example**

```http
GET /api/groups/invite?code=ABCDEF&auth=<token> HTTP/1.1
Host: 127.0.0.1:8080
X-Browser-ID: <BrowserUUID>
```

```json
{ "statusCode": 200, "code": "ABCDEF", "group": 100137 }
```

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
  "livesIcon": "heart"
}
```

---

## Group generate code (lecturer)

Generates a secure 6-character random hex entry code using Node's crypto module.

**Endpoint:** `POST /api/groups/generate-code`

**Headers:**

| Header | Description |
| ------ | ----------- |
| `X-Browser-ID` | Required UUID binding for session verification. |

**Request body (JSON):**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `type` | string (optional) | Code type classification. |

**Response:** `200 OK` with JSON body:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `statusCode` | integer | Always `200`. |
| `code` | string | 6-character uppercase hex string (e.g. `A1B2C3`). |

**Example**

```http
POST /api/groups/generate-code HTTP/1.1
Host: 127.0.0.1:8080
Content-Type: application/json
X-Browser-ID: <BrowserUUID>

{"type":"permanent"}
```

```json
{ "statusCode": 200, "code": "A1B2C3" }
```

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

---

## Drive (lecturer, multipart)

**Endpoint:** `POST /api/drive`

**Headers:**

| Header | Description |
| ------ | ----------- |
| `X-Browser-ID` | Same browser binding as for `/api/groups/new` and `/api/groups/enroll`. |

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

## SAML 2.0 (PIONIER.id / institutional IdP)

These routes implement a **Service Provider (SP)** using `@node-saml/passport-saml`. Configure federation metadata exchange with your IdP (e.g. UAM) and PIONIER.id registration as required by your institution.

### Environment (required for SP to activate)

| Variable | Purpose |
| -------- | ------- |
| `SAML_SP_ENTITY_ID` | SP `entityID` — public URI, often your metadata URL (`…/api/auth/saml/metadata`). |
| `SAML_ACS_URL` | Full URL of the Assertion Consumer Service (**POST** binding; must match metadata and how clients reach the API). |
| `SAML_ENTRY_POINT` | IdP SSO URL — from IdP metadata (`SingleSignOnService`, **Redirect** binding), e.g. `…/idp/profile/SAML2/Redirect/SSO`. |
| `SAML_IDP_CERT` **or** `SAML_IDP_CERT_PATH` | IdP **signing** certificate (PEM). |
| `SAML_SP_PUBLIC_CERT` **or** `SAML_SP_PUBLIC_CERT_PATH` | SP public certificate (PEM). |
| `SAML_SP_PRIVATE_KEY` **or** `SAML_SP_PRIVATE_KEY_PATH` | SP private key (PEM). Used to sign **AuthnRequests** (Redirect) and to advertise `AuthnRequestsSigned` in SP metadata. |
| `SAML_SESSION_JWT_SECRET` | Secret for signing the HTTP-only session JWT. **Required whenever SAML SP routes should activate** (including non-production). |
| `SAML_LOGIN_SUCCESS_REDIRECT_URL` | **Required.** Browser redirect after successful ACS (e.g. SPA origin). Use the same host you use in the browser (`127.0.0.1` vs `localhost` — pick one and use it in `CORS_ORIGIN` too). |
| `SAML_SESSION_JWT_EXPIRES_IN` | Optional. JWT lifetime and cookie `maxAge` (default `8h`). Same format as `jsonwebtoken` / `ms` (e.g. `8h`, `15m`, or seconds as a number string). |
| `SAML_NAMEID_FORMAT` | Optional. NameIDPolicy format (default **transient**, typical for eduGAIN). Set to `omit` or `none` to omit a fixed format (some Shibboleth setups). |
| `SAML_ACCEPT_CLOCK_SKEW_MS` | Optional. Clock skew in ms for assertion validity (default `5000`). |
| `SAML_WANT_AUTHN_RESPONSE_SIGNED` | Optional. Default `true` — require signed `Response` (usual for Shibboleth). |
| `SAML_WANT_ASSERTIONS_SIGNED` | Optional. Default `true` — require signed `Assertion`. |
| `SAML_DISABLE_REQUESTED_AUTHN_CONTEXT` | Optional. Default `true` — do not send requested `AuthnContext` (avoids IdP rejecting unknown contexts). |
| `SAML_SKIP_REQUEST_COMPRESSION` | Optional. Default `false`. Set `true` only if debugging a broken intermediary. |

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

Assertion Consumer Service — accepts `SAMLResponse` (**HTTP-POST**). On success, sets an HTTP-only cookie `maqSamlSession` with a JWT and redirects to `SAML_LOGIN_SUCCESS_REDIRECT_URL` (required in `.env`).

**GET `/api/auth/saml/me`**

Returns **`{ "authenticated": false }`** or **`{ "authenticated": true, "user": { "sub", "email?", "displayName?" } }`** from the cookie. Intended for **smoke / debugging** only — do not rely on it as the sole authorization gate for protected APIs.

### CORS

The API enables **`Access-Control-Allow-Credentials`** so browsers may send cookies when `Origin` is allowlisted and the client uses credentials (see `CORS_ORIGIN`).
