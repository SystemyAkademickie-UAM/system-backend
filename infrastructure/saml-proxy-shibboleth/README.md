# Shibboleth proxy IdP (local) + Nest SP

This stack runs a **Shibboleth Identity Provider 3.4.x** ([`unicon/shibboleth-idp`](https://hub.docker.com/r/unicon/shibboleth-idp)) with a small configuration overlay derived from the [UniconLabs dockerized-idp-testbed](https://github.com/UniconLabs/dockerized-idp-testbed). It lives under **`system-backend/infrastructure/`** so it is versioned with the API repo.

## What is implemented

| Layer | Role |
| ----- | ---- |
| **NestJS (`system-backend`)** | SAML **Service Provider** (`passport-saml`): `/api/auth/saml/login`, `/acs`, `/metadata`. |
| **`proxy-idp` (this compose file)** | Shibboleth **Identity Provider** on container **4443** → host **`https://localhost:14443`**. |
| **`ldap`** | Demo directory for **Password** authentication (`staff1` / `password`, `student1` / `password`). |
| **`metadata/uam-idp-metadata.xml`** | Static UAM IdP metadata ([source](https://sso.amu.edu.pl/simplesaml/saml2/idp/metadata.php)) for federation alignment. |
| **`certs/README.md`** | Points to workspace **`secrets/saml/`** for Nest SP + proxy IdP PEMs (nothing sensitive is committed under `certs/`). |

### Nest ↔ proxy IdP vs proxy IdP ↔ UAM

- **Nest ↔ proxy IdP:** Use `SAML_ENTRY_POINT` = `https://localhost:14443/idp/profile/SAML2/Redirect/SSO` and `SAML_IDP_CERT_PATH` = `../secrets/saml/proxy-idp-signing.pem` (from `system-backend/` cwd; see workspace **`secrets/README.md`**).
- **Proxy IdP ↔ UAM (live delegation):** UAM metadata is loaded for trust and future IdP-to-IdP configuration; enabling **SAML authentication to UAM** needs institution-specific Shibboleth work and UAM registration of this IdP’s `entityID`. Contact [sso@amu.edu.pl](mailto:sso@amu.edu.pl) for production.

## Run

```bash
cd infrastructure/saml-proxy-shibboleth
docker compose build
docker compose up -d
```

Populate **`../../../secrets/saml-proxy-shibboleth/idp-credentials/`** on the host **before** `up` (mounted read-only at `/opt/shibboleth-idp/credentials` — see **`secrets/saml-proxy-shibboleth/README.md`**). The image does not bake in keys.

Jetty PKCS#12 password: **`changeme`**.

### If the browser shows **503** on `/idp/profile/...` (Jetty “Service Unavailable”)

Jetty is up but the IdP webapp did not finish starting. Check logs: `docker compose logs proxy-idp`. A common cause is **`DataSealerKeyStrategy` / `Key was of incorrect type`**: **`secrets/.../idp-credentials/sealer.jks`** must be a **JCEKS** store with an **AES `SecretKeyEntry`** (default alias `secret1`), matching **`sealer.kver`** (`CurrentVersion=1`). Regenerate both as in **Regenerate dev keys** below if you rotated keys incorrectly.

### If `docker compose build` fails on LDAP (`yum` / `mirrorlist.centos.org`)

CentOS 7 is **EOL**; the stock image still points `yum` at retired mirrors. The `ldap/Dockerfile` switches repos to **`vault.centos.org`** before installing packages. If you still see **“Could not resolve host”**, the build environment has no working DNS (check Docker Desktop / corporate firewall). The IdP image (`unicon/shibboleth-idp`) does not use `yum` at build time.

## Nest env (proxy)

From `system-backend/`:

| Variable | Example |
| -------- | ------- |
| `SAML_SP_ENTITY_ID` | `https://127.0.0.1:8080/api/auth/saml/metadata` |
| `SAML_ACS_URL` | `http://127.0.0.1:8080/api/auth/saml/acs` |
| `SAML_ENTRY_POINT` | `https://localhost:14443/idp/profile/SAML2/Redirect/SSO` |
| `SAML_IDP_CERT_PATH` | `../secrets/saml/proxy-idp-signing.pem` |
| `SAML_SP_PUBLIC_CERT_PATH` | `../secrets/saml/nest-sp-cert.pem` |
| `SAML_SP_PRIVATE_KEY_PATH` | `../secrets/saml/nest-sp-key.pem` |

## Smoke script

```powershell
./scripts/verify-saml-proxy-metadata.ps1
```

## Regenerate dev keys

Write outputs under the workspace **`secrets/saml-proxy-shibboleth/idp-credentials/`** (or another path you mount at `/opt/shibboleth-idp/credentials`). Set `OPENSSL_CONF` to `./openssl-min.cnf`, then regenerate RSA keys and PKCS#12 stores. For **`sealer.jks`** (must match `idp.properties` passwords):

```bash
keytool -genseckey -noprompt -alias secret1 -keypass password -storepass password \
  -keyalg AES -keysize 256 -storetype JCEKS \
  -keystore ../../../secrets/saml-proxy-shibboleth/idp-credentials/sealer.jks
```

(Run **`keytool`** from `system-backend/infrastructure/saml-proxy-shibboleth/` so the relative path matches your tree.) Then set **`sealer.kver`** next to that file to `CurrentVersion=1` (see stock Shibboleth format). **Do not use dev keys in production.**
