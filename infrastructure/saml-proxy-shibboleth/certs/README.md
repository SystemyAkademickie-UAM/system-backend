# Nest SP + proxy IdP PEMs (not committed)

Dev TLS and signing material for the **Nest** SAML SP and the **local Shibboleth IdP signing cert** live in the **workspace** folder **`secrets/saml/`** (sibling of `system-backend/`), not in this repository.

1. See **`../../../../secrets/README.md`** for the file list and one-time bootstrap.
2. Point `system-backend/.env` at **`../secrets/saml/*.pem`** (paths relative to the `system-backend/` working directory when using `npm run start:dev`).

The IdP container uses **`secrets/saml-proxy-shibboleth/idp-credentials/`** (mounted by `docker-compose.yml` in this directory).
