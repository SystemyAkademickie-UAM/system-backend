# Installation (backend)

## Requirements

- **Node.js** 24.x (see `.nvmrc`)
- **npm** 10+ (bundled with Node 24). Run `npm install` once to create `package-lock.json`, commit it, then prefer `npm ci` for reproducible installs (switch CI to `npm ci` after the lockfile is in the repo).
- **Docker Engine** (optional), if you run the service from the image instead of Node on the host

Optional on Windows: **nvm-windows** to match Node 24.

## Clone and install

```bash
git clone <your-system-backend-url>
cd system-backend
nvm use    # optional
npm install
cp .env.example .env   # optional
```

## Debian / production host

Use the same Node major version as development, or run the process from the [Dockerfile](../Dockerfile). See [docker.md](./docker.md).
