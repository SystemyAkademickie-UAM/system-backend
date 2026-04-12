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

CI runs unit tests, e2e tests, and build. After lockfiles are committed, prefer `npm ci` over `npm install`.

## Container (this repository only)

See [docker.md](./docker.md).
