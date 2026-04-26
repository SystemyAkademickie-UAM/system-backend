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

## SAML 2.0 (institutional IdP or local Shibboleth proxy)

These routes implement a **Service Provider (SP)** using `@node-saml/passport-saml`.

### Direct IdP (e.g. UAM SimpleSAMLphp)

Point `SAML_ENTRY_POINT` and `SAML_IDP_CERT` / `SAML_IDP_CERT_PATH` at the upstream IdP (see [UAM metadata](https://sso.amu.edu.pl/simplesaml/saml2/idp/metadata.php)). Register the SP metadata from **`GET /api/auth/saml/metadata`** with the IdP operator as required by your federation (e.g. PIONIER.id).

### Local proxy IdP (Nest SP → Shibboleth → LDAP demo users)

For development, run the Docker stack under **`system-backend/infrastructure/saml-proxy-shibboleth/`** and aim the SP at the proxy’s SSO URL and signing certificate (see that folder’s `README.md`). UAM metadata is bundled inside the proxy IdP image for federation alignment; **live SAML delegation to UAM** needs extra Shibboleth and UAM-side configuration beyond this repo.

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
| `SAML_LOGIN_SUCCESS_REDIRECT_URL` | Optional. Browser redirect after successful ACS (default `http://127.0.0.1:3000/home`). |
| `SAML_UAM_ENTRY_POINT` | Optional. UAM SSO URL when using institution id `uam` on **`/auth/saml/login?institution=uam`**. |
| `SAML_UAM_IDP_CERT_PATH` | Optional. PEM for UAM signing cert (defaults to workspace-relative `../secrets/saml/uam-idp-signing.pem` from `system-backend/` cwd when entry point is set). |
| `SAML_LOCAL_PROXY_ENTRY_POINT` | Optional. Overrides local Shibboleth SSO URL for institution `local-proxy` (defaults to `https://localhost:14443/idp/profile/SAML2/Redirect/SSO`). |
| `SAML_LOCAL_PROXY_IDP_CERT_PATH` | Optional. PEM for the local proxy IdP (defaults next to the repo overlay). |
| `SAML_SESSION_JWT_EXPIRES_IN` | Optional. JWT lifetime and cookie `maxAge` (default `8h`). Same format as `jsonwebtoken` / `ms` (e.g. `8h`, `15m`, or seconds as a number string). |
| `SAML_VALIDATE_IN_RESPONSE_TO` | Optional. `never` \| `ifPresent` \| `always` — how to validate SAML `InResponseTo` against the in-memory AuthnRequest cache (default **`ifPresent`** if unset). Use **`never`** for local Shibboleth / `npm run start:dev --watch` so ACS does not return **500** after IdP consent when the process restarted. Production clusters with **`ifPresent`/`always`** should use a **shared `cacheProvider`** (see `@node-saml/node-saml`). |
| `SAML_IDENTIFIER_FORMAT` | Optional. SAML **NameIDPolicy** `Format` URI on AuthnRequest (default **`urn:oasis:names:tc:SAML:2.0:nameid-format:transient`** to match the local Shibboleth IdP metadata). If the IdP returns **`InvalidNameIDPolicy`**, set this to a format the IdP supports (e.g. `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress` when the directory can supply it). |

If any required value is missing, **`/api/auth/saml/login`**, **`/api/auth/saml/metadata`**, and **`/api/auth/saml/acs`** respond with **`503`** and a JSON body with `error: "SAML_NOT_CONFIGURED"` (except **`/api/auth/saml/status`**, which always returns **`200`**).

**InResponseTo:** Controlled by **`SAML_VALIDATE_IN_RESPONSE_TO`** (see table). When set to **`ifPresent`** (the default if the variable is omitted), the SP uses the default in-memory cache from `@node-saml/node-saml`. A **cache miss** (e.g. API restarted between redirect and ACS, or multiple instances without a shared store) surfaces as **`500`** on **`POST /auth/saml/acs`**. Local dev typically sets **`never`**; production with several replicas should use **`ifPresent`/`always`** plus a **shared `cacheProvider`**.

**Signatures:** Both `wantAuthnResponseSigned` and `wantAssertionsSigned` are **false** so `@node-saml` accepts either an **outer `Response` signature** (common for Shibboleth IdP 3) or an **Assertion-only** signature. Tighten these flags (and match your IdP metadata) for stricter deployments.

**Institution picker (dev / UAM):** **`GET /api/auth/saml/institutions`** returns `{ samlReady, institutions[] }` for the SPA. **`GET /api/auth/saml/login?institution=local-proxy`** (or `uam` when `SAML_UAM_*` is set) rebinding the SP to that IdP and sends `RelayState` so **`POST /auth/saml/acs`** selects the matching signing certificate. For **`local-proxy`**, the IdP signing PEM is resolved in order: `SAML_LOCAL_PROXY_IDP_CERT_PATH` (file), default **`../secrets/saml/proxy-idp-signing.pem`** (from `system-backend/` cwd), then the main **`SAML_IDP_CERT` / `SAML_IDP_CERT_PATH`** (Docker dev mounts workspace PEMs under **`/app/secrets/saml`**). Entry point: `SAML_LOCAL_PROXY_ENTRY_POINT`, then **`SAML_ENTRY_POINT`**, then the default Shibboleth dev URL. Not safe under concurrent logins to different IdPs.

**Invalid PEM paths:** Missing files or unreadable `*_PATH` values are treated as “cert not configured” so `/status` and startup do not throw; the SP stays off until paths and files are valid.

### Endpoints

**GET `/api/auth/saml/status`**

Returns whether SAML is configured, plus a boolean checklist for operators.

The `requirements` object only means the related **environment variables are set**. **`configurationComplete`** and **`samlReady`** additionally require **PEM material to load** (see **`pemMaterialLoaded`**). If `requirements` are all `true` but `pemMaterialLoaded` entries are `false`, fix **file paths** (e.g. use absolute paths or correct bind mounts in Docker — relative paths like `./../secrets/` depend on the process working directory).

**GET `/api/auth/saml/metadata`**

Returns **`200`** with **`Content-Type: application/xml`** — SP metadata for IdPs and federation registration.

**GET `/api/auth/saml/institutions`**

Returns **`200`** with JSON: `samlReady` (boolean) and `institutions` (array of `{ id, name, mode }` where `mode` is `ready` | `planned` | `needs_config`). Does **not** require SAML to be configured (always includes the PIONIER.id placeholder as `planned`).

**GET `/api/auth/saml/login`**

Starts SAML **Web SSO** — responds with **`302`** to the IdP `entryPoint` when configured.

Optional query: **`?institution=local-proxy`** or **`?institution=uam`** (when UAM env is complete) for the multi-step UI; unknown ids return **`400`**.

Optional query: **`forceAuthn=1`** — SAML **2.0** standard **`ForceAuthn`** on the `<samlp:AuthnRequest>` (not an application hack): it asks the IdP to perform **fresh** authentication instead of silently reusing an existing browser SSO session. Use after **application logout** when you still need a credential step at the IdP; **SAML Single Logout (SLO)** at the IdP is a separate integration for terminating the IdP session entirely. Combine with **`?institution=…`** as `&forceAuthn=1`. The API clears the per-request flag when **`POST /auth/saml/acs`** runs. Some IdPs ignore `ForceAuthn` or require extra configuration.

**POST `/api/auth/saml/acs`**

Assertion Consumer Service — accepts `SAMLResponse` (HTTP-POST). On success, sets an HTTP-only cookie `maqSamlSession` with a JWT and redirects to `SAML_LOGIN_SUCCESS_REDIRECT_URL`.

**POST `/api/auth/saml/logout`**

Clears the **`maqSamlSession`** cookie (`Set-Cookie` with empty value / expired). Responds **`204`** with no body. This is **application logout** only — it does **not** send a SAML `LogoutRequest` to the IdP (users may still have an IdP browser session for SSO there).

**GET `/api/auth/saml/me`**

Returns **`{ "authenticated": false }`** or **`{ "authenticated": true, "user": { "sub", "email?", "displayName?" } }`** from the cookie. Intended for **smoke / debugging** only — do not rely on it as the sole authorization gate for protected APIs.

### CORS

The API enables **`Access-Control-Allow-Credentials`** so browsers may send cookies when `Origin` is allowlisted and the client uses credentials (see `CORS_ORIGIN`). If **`POST /auth/saml/logout`** fails in the browser (network error / blocked response), the SPA origin is probably missing from the allowlist — set **`CORS_ORIGIN`** to include your UI origin exactly (scheme + host + port, no path). Defaults include common Vite dev ports under **`localhost`** / **`127.0.0.1`**.
