# system-backend

NestJS 11 (TypeScript) HTTP API for Systemy Akademickie UAM. Default URL: `http://127.0.0.1:8080`.

## Quick start

```bash
npm install
cp .env.example .env   # optional
npm run start:dev
```

## Documentation

| Document | Description |
| -------- | ----------- |
| [docs/installation.md](./docs/installation.md) | Requirements and install |
| [docs/running.md](./docs/running.md) | Dev server, production run, tests |
| [docs/docker.md](./docs/docker.md) | Docker image for this service |
| [docs/development.md](./docs/development.md) | Tooling, CI, environment variables |
| [docs/api.md](./docs/api.md) | Requests and responses |

## API (summary)

- `GET /api/counter/health` — smoke check `{ "ok": true }`
- `POST /api/counter/increment` — body `{ "currentCount": number }` → `{ "count": number }` (`201`)

Details in [docs/api.md](./docs/api.md).

## License

[LICENSE.md](./LICENSE.md) (all rights reserved).
