# Installation (backend)

## Requirements

Install the **pinned Node.js and npm versions** first: [prerequisites.md](./prerequisites.md).

- **Docker Engine** (optional), if you run the service from the image instead of Node on the host

After prerequisites, run `npm install` once to create `package-lock.json`, commit it, then prefer `npm ci` for reproducible installs once the lockfile is in the repo.

## Clone and install

```bash
git clone <your-system-backend-url>
cd system-backend
nvm use    # optional
npm install
cp .env.example .env   # required — fill DATABASE_*, SAML_*, and other secrets
```

## Docker Compose (local PostgreSQL)

Required **once per machine** before the first `docker compose` / `npm run docker:*` / `npm run start:dev`:

```bash
docker network create academy-network
```

`docker-compose.yml` attaches `api` and `db` to that external network. If it already exists, Docker prints a harmless error — you can ignore it.

Configure `DATABASE_*` in `.env` to match the Compose `db` service (same user, password, name; host `127.0.0.1` and mapped `DATABASE_PORT` when Nest runs on the host). See [development.md](./development.md) for migrations and startup scripts.

On API startup, [`validate-env.ts`](../src/validate-env.ts) checks that required env vars are **present** (non-empty). Local dev uses a `.env` file; CI and production inject the same variables via orchestration — a `.env` file is not required there.

## Debian / production host

Use the same Node major version as development, or run the process from the [Dockerfile](../Dockerfile). See [docker.md](./docker.md).

Production server operations ( `/opt/maq`, remote Postgres, migrations on container start): [production-deployment.md](./production-deployment.md).
