# Shibboleth IdP credentials (not in Git)

This directory is **empty in the Git tree**. At runtime, `docker compose` mounts the workspace folder **`secrets/saml-proxy-shibboleth/idp-credentials/`** here.

Required files (see workspace **`secrets/README.md`**, **`secrets/saml-proxy-shibboleth/README.md`**, and **`infrastructure/saml-proxy-shibboleth/README.md`** in this repo):

- `idp-signing.key`, `idp-signing.crt`, `idp-encryption.key`, `idp-encryption.crt`
- `idp-browser.p12`, `idp-backchannel.p12` (Jetty TLS; passwords in compose env)
- `ldap-server.key`, `ldap-server.crt` (LDAP TLS trust for the IdP)
- `sealer.jks`, `sealer.kver` (data sealer; JCEKS per Shibboleth docs)

Generate or copy from a trusted local store — **never commit** these files.
