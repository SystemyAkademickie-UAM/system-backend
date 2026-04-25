# Shibboleth proxy IdP (local) + Nest SP

This stack runs a **Shibboleth Identity Provider 3.4.x** ([`unicon/shibboleth-idp`](https://hub.docker.com/r/unicon/shibboleth-idp)) with a small configuration overlay derived from the [UniconLabs dockerized-idp-testbed](https://github.com/UniconLabs/dockerized-idp-testbed). It lives under **`system-backend/infrastructure/`** so it is versioned with the API repo.

## What is implemented

| Layer | Role |
| ----- | ---- |
| **NestJS (`system-backend`)** | SAML **Service Provider** (`passport-saml`): `/api/auth/saml/login`, `/acs`, `/metadata`. |
| **`proxy-idp` (this compose file)** | Shibboleth **Identity Provider** on container **4443** → host **`https://localhost:14443`**. |
| **`ldap`** | Demo directory for **Password** authentication (`staff1` / `password`, `student1` / `password`). |
| **`metadata/uam-idp-metadata.xml`** | Static UAM IdP metadata ([source](https://sso.amu.edu.pl/simplesaml/saml2/idp/metadata.php)) for federation alignment. |
| **`certs/`** | Dev PEM material: Nest SP key/cert, proxy IdP signing PEM, UAM signing leaf. |

### Nest ↔ proxy IdP vs proxy IdP ↔ UAM

- **Nest ↔ proxy IdP:** Use `SAML_ENTRY_POINT` = `https://localhost:14443/idp/profile/SAML2/Redirect/SSO` and `SAML_IDP_CERT_PATH` = `./infrastructure/saml-proxy-shibboleth/certs/proxy-idp-signing.pem` (from `system-backend/` cwd).
- **Proxy IdP ↔ UAM (live delegation):** UAM metadata is loaded for trust and future IdP-to-IdP configuration; enabling **SAML authentication to UAM** needs institution-specific Shibboleth work and UAM registration of this IdP’s `entityID`. Contact [sso@amu.edu.pl](mailto:sso@amu.edu.pl) for production.

## Run

```bash
cd infrastructure/saml-proxy-shibboleth
docker compose build
docker compose up -d
```

Jetty PKCS#12 password: **`changeme`**.

## Nest env (proxy)

From `system-backend/`:

| Variable | Example |
| -------- | ------- |
| `SAML_SP_ENTITY_ID` | `https://127.0.0.1:8080/api/auth/saml/metadata` |
| `SAML_ACS_URL` | `http://127.0.0.1:8080/api/auth/saml/acs` |
| `SAML_ENTRY_POINT` | `https://localhost:14443/idp/profile/SAML2/Redirect/SSO` |
| `SAML_IDP_CERT_PATH` | `./infrastructure/saml-proxy-shibboleth/certs/proxy-idp-signing.pem` |
| `SAML_SP_PUBLIC_CERT_PATH` | `./infrastructure/saml-proxy-shibboleth/certs/nest-sp-cert.pem` |
| `SAML_SP_PRIVATE_KEY_PATH` | `./infrastructure/saml-proxy-shibboleth/certs/nest-sp-key.pem` |

## Smoke script

```powershell
./scripts/verify-saml-proxy-metadata.ps1
```

## Regenerate dev keys

Set `OPENSSL_CONF` to `./openssl-min.cnf`, then regenerate RSA keys and PKCS#12 stores; regenerate `sealer.jks` with `keytool` (JCEKS). **Do not use dev keys in production.**
