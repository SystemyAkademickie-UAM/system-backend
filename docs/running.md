# How to run (backend)

## Development (Node)

```bash
npm run start:dev
```

Starts the local Compose Postgres (`npm run db:up`), applies pending migrations, then Nest in watch mode. Requires a filled `.env` (copy from `.env.example`); missing variables fail fast at startup before Nest boots.

Listen URL: `http://127.0.0.1:8080` unless `PORT` is set in `.env`. Global path prefix: `/api`.

## Production-style (Node, no container)

```bash
npm install
npm run build
npm run start:prod
```

`start:prod` runs compiled migrations before the API process.

## Tests

```bash
npm test
npm run test:e2e
```

With PostgreSQL configured and `TYPEORM_SYNC=false`, apply schema with `npm run migrate` (see [development.md](./development.md)).

End-to-end tests boot the full app with TypeORM and expect a **reachable PostgreSQL** instance configured via `DATABASE_*` (see `.env.example`). Without a live database, `test:e2e` fails while connecting.

## Local SAML (optional)

For institutional login in dev, run the local IdP (`npm run idp:up`), register orgs via [saml-local-idp.md](./saml-local-idp.md), and point **`SAML_ACS_URL`** / **`SAML_LOGIN_SUCCESS_URL`** at the SPA origin (`http://127.0.0.1:3000`). The frontend repo proxies `/api` to this service on **8080**.

CI runs unit tests, e2e tests, and build. After lockfiles are committed, prefer `npm ci` over `npm install`.

## Container (this repository only)

See [docker.md](./docker.md).
