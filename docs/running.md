# How to run (backend)

## Development (Node)

```bash
npm run start:dev
```

Listen URL: `http://127.0.0.1:8080` unless `PORT` is set in `.env`. Global path prefix: `/api`.

## Production-style (Node, no container)

```bash
npm install
npm run build
npm run start:prod
```

## Tests

```bash
npm test
npm run test:e2e
```

With PostgreSQL configured and `TYPEORM_SYNC=false`, apply schema once with `npm run typeorm:migration:run` (see [development.md](./development.md)).

End-to-end tests boot the full app with TypeORM and expect a **reachable PostgreSQL** instance configured via `DATABASE_*` (see `.env.example`). Without a live database, `test:e2e` fails while connecting.

CI runs unit tests, e2e tests, and build. After lockfiles are committed, prefer `npm ci` over `npm install`.

## Container (this repository only)

See [docker.md](./docker.md).
