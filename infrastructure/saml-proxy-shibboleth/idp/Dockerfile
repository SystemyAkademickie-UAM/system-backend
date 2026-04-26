# Shibboleth Identity Provider 3.4.x (Unicon) with project overlay — see ../README.md
# Key material is **not** baked into the image: mount `secrets/saml-proxy-shibboleth/idp-credentials` at runtime (see docker-compose.yml).
FROM unicon/shibboleth-idp:3.4.3

COPY shibboleth-idp/conf /opt/shibboleth-idp/conf
COPY shibboleth-idp/metadata /opt/shibboleth-idp/metadata
COPY shib-jetty-base/ /opt/shib-jetty-base/
RUN mkdir -p /opt/shibboleth-idp/credentials && chmod 755 /opt/shibboleth-idp/credentials
