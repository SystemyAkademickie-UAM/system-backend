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
| `SAML_METADATA_TECH_CONTACT_GIVEN_NAME` | **Required for `/metadata`.** `md:ContactPerson` / `md:GivenName` (together with email). |
| `SAML_METADATA_TECH_CONTACT_EMAIL` | **Required for `/metadata`.** `md:EmailAddress` (`mailto:` added if omitted). |
| `SAML_METADATA_SLO_REDIRECT_URL` | **Required for `/metadata`.** `SingleLogoutService` **HTTP-Redirect** Location. Use your public **`GET /api/auth/saml/logout`** URL so it matches a real route. |
| `SAML_IDP_LOGOUT_URL` | Optional. IdP **SingleLogoutService** URL for SP-initiated SLO (defaults to UAM `SingleLogoutService.php`). Override when your IdP exposes a different endpoint. |
| `SAML_METADATA_INCLUDE_ARTIFACT_ACS` | Optional. When `true` / `1` / `yes`, **`GET /metadata`** adds **`AssertionConsumerService` HTTP-Artifact** (`index="1"`). **Default:** omitted / falsy — export matches POST-only runtime (recommended for UAM until artifact resolution exists). |

If core SAML env is incomplete, **`/api/auth/saml/login`**, **`/api/auth/saml/acs`**, and **`/api/auth/saml/logout`** respond with **`503`** and `error: "SAML_NOT_CONFIGURED"` when the Passport strategy is off.

**`GET /api/auth/saml/metadata`** returns **`503`** with `error: "SAML_METADATA_EXPORT_INCOMPLETE"` when the SP is otherwise ready but **`SAML_METADATA_SLO_REDIRECT_URL`** or **`SAML_METADATA_TECH_CONTACT_*`** is missing — those fields are required so the exported XML matches the UAM **`default-sp`** template.

**`GET /api/auth/saml/status`** always returns **`200`**.

**InResponseTo:** The SP validates SAML responses against the AuthnRequest ID (`validateInResponseTo: always`) using the default in-memory cache from `@node-saml/node-saml`. **Multiple API instances** behind a load balancer must use a **shared cache provider** (see node-saml `cacheProvider`) or logins may fail intermittently.

**Invalid PEM paths:** Missing files or unreadable `*_PATH` values are treated as “cert not configured” so `/status` and startup do not throw; the SP stays off until paths and files are valid.

### Endpoints

**GET `/api/auth/saml/status`**

Returns whether SAML is configured, plus a boolean checklist for operators.

The `requirements` object only means the related **environment variables are set**. **`SAML_METADATA_INCLUDE_ARTIFACT_ACS`** in `requirements` is **true** only when that flag is set to a truthy value (`true` / `1` / `yes`). **`configurationComplete`** and **`samlReady`** additionally require **PEM material to load** (see **`pemMaterialLoaded`**). **`metadataExportReady`** means **`GET /metadata`** can return XML (SLO URL + technical contact set). **`metadataArtifactAcsAdvertised`** mirrors whether exported XML includes the optional HTTP-Artifact ACS row.

**GET `/api/auth/saml/metadata`**

Returns **`200`** with **`Content-Type: application/xml`**.

The document follows the **UAM SimpleSAMLphp `default-sp` layout**: **only** `xmlns:md` on the root (no `ds:` block, **no** `<X509Certificate>`). Children under `<md:SPSSODescriptor>` are **`SingleLogoutService`**, **`AssertionConsumerService` HTTP-POST** (`index="0"`), then optionally **`AssertionConsumerService` HTTP-Artifact** (`index="1"`, same Location) when **`SAML_METADATA_INCLUDE_ARTIFACT_ACS`** is truthy, then **`md:ContactPerson`** after the descriptor.

Register your SP **signing certificate with the IdP separately** (they cannot read it from this XML).

**Runtime:** **`/acs`** accepts **HTTP-POST** (`SAMLResponse`) only. Enabling HTTP-Artifact in metadata **without** implementing SOAP artifact resolution will break logins for IdPs that choose that binding — enable **`SAML_METADATA_INCLUDE_ARTIFACT_ACS`** only when you accept that risk or have implemented resolution.

**GET `/api/auth/saml/logout`** and **POST `/api/auth/saml/logout`**

Single Logout Service URL — advertised in metadata as **HTTP-Redirect** and **HTTP-POST** (same Location).

- **SP-initiated logout:** authenticated session → SAML **`LogoutRequest`** (Redirect **or** POST **binding**, picked by `@node-saml`) to **`SAML_IDP_LOGOUT_URL`** (default UAM SLO). Browser follows IdP flow.
- **IdP-initiated logout:** IdP sends **`LogoutRequest`** here → SP validates **NameID** / session fields against the JWT → clears **`maqSamlSession`** → **`LogoutResponse`** back to IdP.
- **LogoutResponse from IdP** (after SP-initiated round-trip): validates **`SAMLResponse`** → clears cookie → redirect to **`SAML_LOGIN_SUCCESS_REDIRECT_URL`**.

Unauthenticated **GET** (no valid cookie): clears any stale cookie and redirects to **`SAML_LOGIN_SUCCESS_REDIRECT_URL`** without contacting the IdP.

Session JWT carries **`nameID`**, **`sessionIndex`**, **`nameIDFormat`**, and related qualifiers when the IdP provides them (needed for compliant **`LogoutRequest`** / matching IdP-initiated requests).

**GET `/api/auth/saml/login`**

Starts SAML **Web SSO** — responds with **`302`** to the IdP `entryPoint` when configured.

**POST `/api/auth/saml/acs`**

Assertion Consumer Service — accepts `SAMLResponse` (HTTP-POST). On success, sets an HTTP-only cookie `maqSamlSession` with a JWT and redirects to `SAML_LOGIN_SUCCESS_REDIRECT_URL`.

**GET `/api/auth/saml/me`**

Returns **`{ "authenticated": false }`** or **`{ "authenticated": true, "user": { "sub", "email?", "displayName?" } }`** from the cookie. Intended for **smoke / debugging** only — do not rely on it as the sole authorization gate for protected APIs.

### CORS

The API enables **`Access-Control-Allow-Credentials`** so browsers may send cookies when `Origin` is allowlisted and the client uses credentials (see `CORS_ORIGIN`).
